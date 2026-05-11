import nodemailer from 'nodemailer';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import Handlebars from 'handlebars';
import mailConfig from '../config/mail.js';

class Mail {
  private transporter: any;
  private templatesDir: string;

  constructor() {
    const { host, port, secure, auth } = mailConfig;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: auth.user ? auth : null,
    } as import('nodemailer').TransportOptions);

    this.templatesDir = resolve(process.cwd(), 'src', 'app', 'Views', 'emails');
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
