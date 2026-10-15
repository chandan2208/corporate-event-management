/**
 * Local SMTP capture server for automated tests (Phase 15).
 *
 * A real SMTP server (the `smtp-server` package) that accepts mail over a
 * real SMTP conversation — including AUTH, so the backend's credentialed
 * Nodemailer transport is exercised exactly as in production — and keeps
 * each parsed message in memory instead of delivering it. Test suites read
 * the verification code from the captured email the same way a person
 * would read it from their inbox.
 *
 * Dev-only: never required by the application itself.
 */

const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');

const startMailSink = async ({ port, user, pass }) => {
  const messages = [];

  const server = new SMTPServer({
    secure: false,
    disabledCommands: ['STARTTLS'],
    authOptional: !user,
    allowInsecureAuth: true,
    logger: false,
    onAuth(auth, session, callback) {
      if (user && (auth.username !== user || auth.password !== pass)) {
        return callback(new Error('Invalid username or password'));
      }
      return callback(null, { user: auth.username });
    },
    onData(stream, session, callback) {
      simpleParser(stream)
        .then((parsed) => {
          messages.push({
            to: (parsed.to?.value || []).map((a) => a.address.toLowerCase()),
            from: parsed.from?.text || '',
            subject: parsed.subject || '',
            text: parsed.text || '',
            html: parsed.html || '',
            authUser: session.user,
            receivedAt: Date.now(),
          });
          callback();
        })
        .catch(callback);
    },
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const messagesFor = (address) => messages.filter((m) => m.to.includes(address.toLowerCase()));

  /** Waits for the Nth (1-based) email to `address`. */
  const waitForEmail = async (address, nth = 1, timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const list = messagesFor(address);
      if (list.length >= nth) return list[nth - 1];
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };

  const extractCode = (message) => {
    const match = message && /\b(\d{6})\b/.exec(message.text);
    return match ? match[1] : null;
  };

  const close = () => new Promise((resolve) => server.close(resolve));

  return { messages, messagesFor, waitForEmail, extractCode, close };
};

module.exports = { startMailSink };
