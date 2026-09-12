import { Router, Response } from 'express';
import { Client, TimeSession } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

export const clientsRouter = Router();

clientsRouter.use(authMiddleware);

// GET /api/clients
clientsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clients = await Client.findAll({
      where: {
        tenant_id: req.tenantId!,
      },
      order: [['name', 'ASC']],
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
