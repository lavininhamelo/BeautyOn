const port = Number(process.env.MAIL_PORT) || 587;
const user = process.env.MAIL_USER || '';
const fromName = process.env.MAIL_FROM_NAME || 'BeautyOn';
const fromAddress = process.env.MAIL_FROM || user;

export default {
  host: process.env.MAIL_HOST,
  port,
  secure: port === 465,
  auth: {
    user,
    pass: process.env.MAIL_PASS,
  },
  default: {
    from: fromAddress ? `${fromName} <${fromAddress}>` : fromName,
  },
};
