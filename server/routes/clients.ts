import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Client, ClientContact, TimeSession } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

export const clientsRouter = Router();

clientsRouter.use(authMiddleware);

function generateRandomPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// GET /api/clients
clientsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clients = await Client.findAll({
      where: {
        tenant_id: req.tenantId!,
      },
      include: [
        {
          model: ClientContact,
          as: 'Contacts',
          attributes: { exclude: ['password_hash'] },
        },
      ],
      order: [
        ['name', 'ASC'],
        [{ model: ClientContact, as: 'Contacts' }, 'created_at', 'ASC'],
      ],
    });
    return res.json({ clients });
  } catch (err: any) {
    console.error('Error fetching clients:', err);
    return res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// POST /api/clients
clientsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, company, email, hourly_rate, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do cliente é obrigatório' });
    }

    const client = await Client.create({
      tenant_id: req.tenantId!,
      name: name.trim(),
      company: company?.trim() || null,
      email: email?.trim() || null,
      hourly_rate: hourly_rate ? Number(hourly_rate) : null,
      notes: notes?.trim() || null,
    });

    return res.status(201).json({ message: 'Cliente cadastrado com sucesso', client });
  } catch (err: any) {
    console.error('Error creating client:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente' });
  }
});

// PUT /api/clients/:id
clientsRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, company, email, hourly_rate, notes } = req.body;

    const client = await Client.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    if (name !== undefined) client.name = name.trim();
    if (company !== undefined) client.company = company ? company.trim() : null;
    if (email !== undefined) client.email = email ? email.trim() : null;
    if (hourly_rate !== undefined) client.hourly_rate = hourly_rate ? Number(hourly_rate) : null;
    if (notes !== undefined) client.notes = notes ? notes.trim() : null;

    await client.save();

    return res.json({ message: 'Cliente atualizado com sucesso', client });
  } catch (err: any) {
    console.error('Error updating client:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// DELETE /api/clients/:id
clientsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Unlink sessions referencing this client or prevent deletion if sessions exist
    await TimeSession.update(
      { client_id: null },
      { where: { client_id: id, tenant_id: req.tenantId! } }
    );

    await client.destroy();

    return res.json({ message: 'Cliente excluído com sucesso' });
  } catch (err: any) {
    console.error('Error deleting client:', err);
    return res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
});

// GET /api/clients/:id/contacts
clientsRouter.get('/:id/contacts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const client = await Client.findOne({
      where: { id, tenant_id: req.tenantId! },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const contacts = await ClientContact.findAll({
      where: { client_id: id, tenant_id: req.tenantId! },
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'ASC']],
    });

    return res.json({ contacts });
  } catch (err: any) {
    console.error('Error fetching contacts:', err);
    return res.status(500).json({ error: 'Erro ao buscar contatos do cliente' });
  }
});

// POST /api/clients/:id/contacts
// Adds a contact with auto-generated temporary password and must_change_password flag
clientsRouter.post('/:id/contacts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone } = req.body;

    const client = await Client.findOne({
      where: { id, tenant_id: req.tenantId! },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do contato é obrigatório' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'O e-mail do contato é obrigatório' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already taken by another contact in this workspace
    const existingContact = await ClientContact.findOne({
      where: {
        tenant_id: req.tenantId!,
        email: normalizedEmail,
      },
    });

    if (existingContact) {
      return res.status(400).json({ error: 'Já existe um contato cadastrado com este e-mail neste workspace' });
    }

    // Generate random temporary password
    const tempPassword = generateRandomPassword(8);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const contact = await ClientContact.create({
      tenant_id: req.tenantId!,
      client_id: id,
      name: name.trim(),
      email: normalizedEmail,
      role: role ? role.trim() : null,
      phone: phone ? phone.trim() : null,
      password_hash: passwordHash,
      must_change_password: true,
    });

    return res.status(201).json({
      message: 'Contato cadastrado com sucesso!',
      contact: {
        id: contact.id,
        client_id: contact.client_id,
        name: contact.name,
        email: contact.email,
        role: contact.role,
        phone: contact.phone,
        must_change_password: contact.must_change_password,
        created_at: contact.created_at,
      },
      tempPassword,
    });
  } catch (err: any) {
    console.error('Error creating contact:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar contato' });
  }
});

// POST /api/clients/:id/contacts/:contactId/reset-password
// Generates a new random temporary password for the contact and resets must_change_password to true
clientsRouter.post('/:id/contacts/:contactId/reset-password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, contactId } = req.params;

    const contact = await ClientContact.findOne({
      where: {
        id: contactId,
        client_id: id,
        tenant_id: req.tenantId!,
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const tempPassword = generateRandomPassword(8);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    contact.password_hash = passwordHash;
    contact.must_change_password = true;
    await contact.save();

    return res.json({
      message: 'Senha temporária gerada com sucesso!',
      contactId: contact.id,
      email: contact.email,
      tempPassword,
    });
  } catch (err: any) {
    console.error('Error resetting contact password:', err);
    return res.status(500).json({ error: 'Erro ao redefinir senha do contato' });
  }
});

// DELETE /api/clients/:id/contacts/:contactId
clientsRouter.delete('/:id/contacts/:contactId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, contactId } = req.params;

    const contact = await ClientContact.findOne({
      where: {
        id: contactId,
        client_id: id,
        tenant_id: req.tenantId!,
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    await contact.destroy();

    return res.json({ message: 'Contato excluído com sucesso' });
  } catch (err: any) {
    console.error('Error deleting contact:', err);
    return res.status(500).json({ error: 'Erro ao excluir contato' });
  }
});

