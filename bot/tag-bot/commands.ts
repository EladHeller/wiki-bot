export default function tagCommandPattern(botName: string, commands: string[]): RegExp {
  const bot = RegExp.escape(botName);
  const alternatives = commands.map((command) => RegExp.escape(command)).join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{N}_@])@(?:(?:משתמש|user):)?${bot}\\s+(${alternatives}):([\\s\\S]*)`,
    'iu',
  );
}
