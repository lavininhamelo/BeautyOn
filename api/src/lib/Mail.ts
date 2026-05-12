import nodemailer from 'nodemailer';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import Handlebars from 'handlebars';
import mailConfig from '../config/mail.js';
import { projectRoot } from './paths.js';

function resolveTemplatesDir(): string {
  const candidates = [
    resolve(projectRoot, 'src', 'app', 'Views', 'emails'),
    resolve(projectRoot, 'dist', 'app', 'Views', 'emails'),
    resolve(process.cwd(), 'api', 'src', 'app', 'Views', 'emails'),
    resolve(process.cwd(), 'src', 'app', 'Views', 'emails'),
  ];
  return candidates.find(p => existsSync(p)) ?? candidates[0];
}

class Mail {
  private transporter: any;
  private templatesDir: string;

  constructor() {
    const { host, port, secure, auth } = mailConfig;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: auth.user ? auth : null,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    } as import('nodemailer').TransportOptions);

    this.templatesDir = resolveTemplatesDir();
    this.configureTemplates().catch(err => {
      console.error('Mail templates init failed', err);
    });
  }

  async configureTemplates() {
    const footer = await readFile(resolve(this.templatesDir, 'partials', 'footer.hbs'), 'utf8');
    Handlebars.registerPartial('footer', footer);
  }

  private async renderTemplate(template: string, context: Record<string, any>) {
    const layoutSource = await readFile(
      resolve(this.templatesDir, 'layouts', 'default.hbs'),
      'utf8'
    );
    const templateSource = await readFile(resolve(this.templatesDir, `${template}.hbs`), 'utf8');

    const bodyHtml = Handlebars.compile(templateSource)(context);
    const fullHtml = Handlebars.compile(layoutSource)({ body: bodyHtml });

    return fullHtml;
  }

  async sendMail(message: any) {
    const { template, context, ...rest } = message || {};

    const html = template ? await this.renderTemplate(template, context || {}) : undefined;

    return this.transporter.sendMail({
      ...mailConfig.default,
      ...rest,
      ...(html ? { html } : {}),
    });
  }
}

export default new Mail();
