import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { SharedReport, TimeSession, Task, Tenant, Client, ClientContact } from '../db';
import { calculateSessionMetrics } from './reports';

export const publicRouter = Router();

// GET /api/public/shared/:token
// Rota sem middleware de sessão. Retorna os dados agregados vinculados ao token para leitura.
publicRouter.get('/shared/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token de compartilhamento não informado' });
    }

    // Try finding in SharedReports first
    const shared = await SharedReport.findOne({
      where: { token },
      include: [
        {
          model: Client,
          as: 'Client',
        },
      ],
    });

    let tenantId: string | null = null;
    let hourlyRate = 150.0;
    let title = 'Relatório de Prestação de Contas';
    let includeCost = true;
    let allowApproval = true;
    let whereClause: any = {};

    if (shared) {
      tenantId = shared.tenant_id;
      hourlyRate = shared.hourly_rate;
      title = shared.title;
      includeCost =
        shared.include_cost !== undefined && shared.include_cost !== null
          ? shared.include_cost === true || (shared.include_cost as any) === 1 || (shared.include_cost as any) === '1'
          : true;
      allowApproval =
        shared.allow_approval !== undefined && shared.allow_approval !== null
          ? shared.allow_approval === true || (shared.allow_approval as any) === 1 || (shared.allow_approval as any) === '1'
          : true;

      whereClause = { tenant_id: tenantId };
      if (shared.session_id) {
        whereClause.id = shared.session_id;
      } else {
        if (shared.client_id) {
          whereClause.client_id = shared.client_id;
        }
        if (shared.start_date || shared.end_date) {
          whereClause.start_time = {};
          if (shared.start_date) {
            const start = new Date(shared.start_date);
            start.setHours(0, 0, 0, 0);
            whereClause.start_time[Op.gte] = start;
          }
          if (shared.end_date) {
            const end = new Date(shared.end_date);
            end.setHours(23, 59, 59, 999);
            whereClause.start_time[Op.lte] = end;
          }
        }
      }
    } else {
      // Check if it's a direct session public_token
      const sessionByToken = await TimeSession.findOne({
        where: { public_token: token },
        include: [{ model: Client, as: 'Client' }],
      });

      if (!sessionByToken) {
        return res.status(404).json({ error: 'Relatório ou sessão não encontrada ou token expirado.' });
      }

      tenantId = sessionByToken.tenant_id;
      title = `Relatório: ${sessionByToken.title}`;
      whereClause = { id: sessionByToken.id, tenant_id: tenantId };
      if (sessionByToken.Client?.hourly_rate) {
        hourlyRate = sessionByToken.Client.hourly_rate;
      }
    }

    const tenant = tenantId ? await Tenant.findByPk(tenantId) : null;

    const sessions = await TimeSession.findAll({
      where: whereClause,
      include: [
        {
          model: Task,
          as: 'Tasks',
        },
        {
          model: Client,
          as: 'Client',
        },
      ],
      order: [['start_time', 'DESC']],
    });

    let totalDurationMs = 0;
    let totalTasksCount = 0;
    let totalBillableAmount = 0;
    const appliedRates = new Set<number>();

    const mappedSessions = sessions.map((sess) => {
      // O valor da sessão é calculado por sessão/cliente com prioridade para taxa editada na sessão
      const sessionRate = sess.hourly_rate ?? (sess.Client?.hourly_rate ?? hourlyRate);
      appliedRates.add(sessionRate);

      const metrics = calculateSessionMetrics(sess, sessionRate);
      totalDurationMs += metrics.durationMs;
      totalTasksCount += sess.Tasks ? sess.Tasks.length : 0;
      // O valor final do relatório é a soma exata dos valores individuais calculados por sessão
      totalBillableAmount = Number((totalBillableAmount + metrics.billableAmount).toFixed(2));

      return {
        id: sess.id,
        title: sess.title,
        notes: sess.notes,
        start_time: sess.start_time,
        end_time: sess.end_time,
        target_minutes: sess.target_minutes,
        hourly_rate: includeCost ? sess.hourly_rate : null,
        is_locked: sess.is_locked || false,
        locked_at: sess.locked_at,
        locked_reason: sess.locked_reason,
        client: sess.Client
          ? {
              id: sess.Client.id,
              name: sess.Client.name,
              hourly_rate: includeCost ? sess.Client.hourly_rate : null,
            }
          : null,
        tasks: (sess.Tasks || []).map((t) => ({
          id: t.id,
          description: t.description,
          notes: t.notes,
          link: t.link,
          created_at: t.created_at,
        })),
        metrics: includeCost
          ? metrics
          : {
              durationMs: metrics.durationMs,
              durationMinutes: metrics.durationMinutes,
              decimalHours: metrics.decimalHours,
              hourlyRate: null,
              appliedHourlyRate: null,
              billableAmount: null,
              isActive: metrics.isActive,
            },
      };
    });

    const totalDecimalHours = Number((totalDurationMs / 3600000).toFixed(2));
    totalBillableAmount = Number(totalBillableAmount.toFixed(2));
    const totalMinutes = Math.round(totalDurationMs / 60000);
    const hasMultipleRates = appliedRates.size > 1;
    const effectiveRate = appliedRates.size === 1 ? Array.from(appliedRates)[0] : hourlyRate;

    return res.json({
      title,
      workspace: tenant ? tenant.name : 'Workspace',
      generated_at: new Date().toISOString(),
      approval_status: shared ? shared.status || 'pending' : 'pending',
      approved_by: shared ? shared.approved_by || null : null,
      approved_at: shared ? shared.approved_at || null : null,
      approval_ip: shared ? shared.approval_ip || null : null,
      include_cost: includeCost,
      allow_approval: allowApproval,
      summary: {
        totalDurationMs,
        totalMinutes,
        totalDecimalHours,
        hourlyRate: includeCost ? effectiveRate : null,
        hasMultipleRates: includeCost ? hasMultipleRates : false,
        totalBillableAmount: includeCost ? totalBillableAmount : null,
        totalSessionsCount: mappedSessions.length,
        totalTasksCount,
        currency: 'BRL',
      },
      sessions: mappedSessions,
    });
  } catch (err: any) {
    console.error('Error serving public shared report:', err);
    res.status(500).json({ error: 'Erro ao consultar relatório público' });
  }
});

// POST /api/public/shared/:token/review
// Process approval or rejection with contact authentication (email + password), first-access password setup, or legacy approval_code
publicRouter.post('/shared/:token/review', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { action, email, password, new_password, approval_code, approver_name } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token não informado' });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Ação inválida (deve ser approve ou reject)' });
    }

    const shared = await SharedReport.findOne({ where: { token } });
    if (!shared) {
      return res.status(404).json({ error: 'Relatório compartilhado não encontrado' });
    }

    if (!shared.allow_approval) {
      return res.status(403).json({ error: 'A aprovação interativa está desativada para este relatório.' });
    }

    if (shared.status && shared.status !== 'pending') {
      return res.status(400).json({
        error: `Este relatório já foi avaliado anteriormente (${shared.status === 'approved' ? 'Aprovado' : 'Rejeitado'}).`,
      });
    }

    let approverIdentity = '';
    let passwordChangedOnLogin = false;

    // Option A: Contact credentials flow (Preferred & default)
    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();

      if (!password) {
        return res.status(400).json({ error: 'Informe a senha de acesso do contato.' });
      }

      // Find contact: first for specific client, then fallback to tenant
      let contact: ClientContact | null = null;
      if (shared.client_id) {
        contact = await ClientContact.findOne({
          where: {
            email: normalizedEmail,
            client_id: shared.client_id,
          },
        });
      }

      if (!contact) {
        contact = await ClientContact.findOne({
          where: {
            email: normalizedEmail,
            tenant_id: shared.tenant_id,
          },
        });
      }

      if (!contact) {
        return res.status(401).json({
          error: 'Nenhum contato encontrado com este e-mail para este cliente/workspace.',
        });
      }

      // Verify current / temporary password
      const isValidPassword = await bcrypt.compare(password, contact.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Senha incorreta. Verifique suas credenciais de acesso.',
        });
      }

      // Check first access (must_change_password flag)
      if (contact.must_change_password) {
        // If client hasn't sent new_password yet, inform that first-access requires new password
        if (!new_password || !new_password.trim()) {
          return res.json({
            requires_new_password: true,
            contact_id: contact.id,
            contact_name: contact.name,
            contact_email: contact.email,
            message: 'Primeiro acesso detectado com senha temporária. Por favor, cadastre uma nova senha pessoal para concluir a aprovação.',
          });
        }

        // Validate new password
        const cleanNewPassword = new_password.trim();
        if (cleanNewPassword.length < 6) {
          return res.status(400).json({
            error: 'A nova senha deve possuir pelo menos 6 caracteres.',
          });
        }

        if (cleanNewPassword === password) {
          return res.status(400).json({
            error: 'A nova senha deve ser diferente da senha temporária inicial.',
          });
        }

        // Hash new password and update contact
        const salt = await bcrypt.genSalt(10);
        contact.password_hash = await bcrypt.hash(cleanNewPassword, salt);
        contact.must_change_password = false;
        contact.last_login_at = new Date();
        await contact.save();
        passwordChangedOnLogin = true;
      } else {
        contact.last_login_at = new Date();
        await contact.save();
      }

      const roleSuffix = contact.role ? ` - ${contact.role}` : '';
      approverIdentity = `${contact.name} (${contact.email}${roleSuffix})`;
    }
    // Option B: Legacy fallback using approval_code
    else if (approval_code && approval_code.trim()) {
      if (shared.approval_code.trim().toUpperCase() !== approval_code.trim().toUpperCase()) {
        return res.status(400).json({ error: 'Código de aprovação incorreto.' });
      }
      approverIdentity = approver_name && approver_name.trim() ? approver_name.trim() : 'Aprovador Autorizado';
    } else {
      return res.status(400).json({
        error: 'Informe seu e-mail e senha de contato para realizar a aprovação.',
      });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const now = new Date();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await shared.update({
      status: newStatus,
      approved_by: approverIdentity,
      approved_at: now,
      approval_ip: clientIp,
    });

    // Na aprovação do relatório, trava as sessões correspondentes no banco de dados para que nada mais possa ser alterado
    if (action === 'approve') {
      const sessionWhere: any = { tenant_id: shared.tenant_id };
      if (shared.session_id) {
        sessionWhere.id = shared.session_id;
      } else {
        if (shared.client_id) {
          sessionWhere.client_id = shared.client_id;
        }
        if (shared.start_date || shared.end_date) {
          sessionWhere.start_time = {};
          if (shared.start_date) {
            const start = new Date(shared.start_date);
            start.setHours(0, 0, 0, 0);
            sessionWhere.start_time[Op.gte] = start;
          }
          if (shared.end_date) {
            const end = new Date(shared.end_date);
            end.setHours(23, 59, 59, 999);
            sessionWhere.start_time[Op.lte] = end;
          }
        }
      }

      await TimeSession.update(
        {
          is_locked: true,
          locked_at: now,
          locked_reason: `Aprovado via relatório "${shared.title}" por ${approverIdentity}`,
        },
        { where: sessionWhere }
      );
    }

    return res.json({
      message: action === 'approve' ? 'Relatório aprovado com sucesso!' : 'Relatório rejeitado com sucesso.',
      status: newStatus,
      approved_by: shared.approved_by,
      approved_at: shared.approved_at,
      approval_ip: shared.approval_ip,
      password_changed_on_login: passwordChangedOnLogin,
    });
  } catch (err: any) {
    console.error('Error reviewing shared report:', err);
    res.status(500).json({ error: 'Erro ao processar aprovação/rejeição' });
  }
});

// In-memory cache for link metadata
interface LinkMetadata {
  url: string;
  originalUrl: string;
  hostname: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  cachedAt: number;
}
const linkMetadataCache = new Map<string, LinkMetadata>();

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractMetaTag(html: string, propertyOrName: string): string | null {
  const p1 = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["']${propertyOrName}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const p2 = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*\\s+(?:property|name)=["']${propertyOrName}["']`,
    'i'
  );

  const m1 = html.match(p1);
  if (m1 && m1[1]) return decodeHtmlEntities(m1[1]);

  const m2 = html.match(p2);
  if (m2 && m2[1]) return decodeHtmlEntities(m2[1]);

  return null;
}

function isSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]'
    ) {
      return false;
    }
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/.test(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// GET /api/public/link-metadata?url=...
publicRouter.get('/link-metadata', async (req: Request, res: Response) => {
  const targetUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';

  if (!targetUrl || !isSafeUrl(targetUrl)) {
    return res.status(400).json({ error: 'URL inválida ou não permitida' });
  }

  // Check cache (valid for 1 hour)
  const cached = linkMetadataCache.get(targetUrl);
  if (cached && Date.now() - cached.cachedAt < 3600000) {
    return res.json(cached);
  }

  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    return res.status(400).json({ error: 'URL inválida' });
  }

  const defaultFavicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  const fallbackResult: LinkMetadata = {
    url: targetUrl,
    originalUrl: targetUrl,
    hostname,
    title: hostname,
    description: null,
    image: null,
    siteName: hostname,
    favicon: defaultFavicon,
    cachedAt: Date.now(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; CronosBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const finalUrl = response.url || targetUrl;
    let finalHost = hostname;
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch {}

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      const nonHtmlResult: LinkMetadata = {
        url: finalUrl,
        originalUrl: targetUrl,
        hostname: finalHost,
        title: finalHost,
        description: null,
        image: null,
        siteName: finalHost,
        favicon: `https://www.google.com/s2/favicons?domain=${finalHost}&sz=128`,
        cachedAt: Date.now(),
      };
      linkMetadataCache.set(targetUrl, nonHtmlResult);
      return res.json(nonHtmlResult);
    }

    // Read only up to 250KB of HTML to be fast
    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 256000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
      reader.cancel().catch(() => {});
    } else {
      const text = await response.text();
      html = text.slice(0, 256000);
    }

    // Extract OpenGraph / Meta information
    const ogTitle = extractMetaTag(html, 'og:title');
    const twitterTitle = extractMetaTag(html, 'twitter:title');
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const docTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : null;
    const resolvedTitle = ogTitle || twitterTitle || docTitle || finalHost;

    const ogDescription = extractMetaTag(html, 'og:description');
    const twitterDescription = extractMetaTag(html, 'twitter:description');
    const metaDescription = extractMetaTag(html, 'description');
    const resolvedDescription = ogDescription || twitterDescription || metaDescription || null;

    const ogSiteName = extractMetaTag(html, 'og:site_name');
    const resolvedSiteName = ogSiteName || finalHost;

    let resolvedImage: string | null = null;
    const rawImage =
      extractMetaTag(html, 'og:image') ||
      extractMetaTag(html, 'og:image:url') ||
      extractMetaTag(html, 'twitter:image') ||
      extractMetaTag(html, 'twitter:image:src');
    if (rawImage) {
      try {
        resolvedImage = new URL(rawImage, finalUrl).href;
      } catch {}
    }

    let resolvedFavicon: string | null = null;
    const iconMatch =
      html.match(/<link\s+[^>]*rel=["'](?:shortcut\s+)?icon|apple-touch-icon["'][^>]*href=["']([^"']*)["']/i) ||
      html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut\s+)?icon|apple-touch-icon["']/i);
    if (iconMatch && iconMatch[1]) {
      try {
        resolvedFavicon = new URL(iconMatch[1], finalUrl).href;
      } catch {}
    }
    if (!resolvedFavicon) {
      resolvedFavicon = `https://www.google.com/s2/favicons?domain=${finalHost}&sz=128`;
    }

    const result: LinkMetadata = {
      url: finalUrl,
      originalUrl: targetUrl,
      hostname: finalHost,
      title: resolvedTitle,
      description: resolvedDescription,
      image: resolvedImage,
      siteName: resolvedSiteName,
      favicon: resolvedFavicon,
      cachedAt: Date.now(),
    };

    linkMetadataCache.set(targetUrl, result);
    return res.json(result);
  } catch (err) {
    // If fetching failed (e.g. timeout, site blocks bots), return the fallback
    linkMetadataCache.set(targetUrl, fallbackResult);
    return res.json(fallbackResult);
  }
});
