import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi from '../../wiki/WikiApi';
import runInactiveKnowledgeExperts from './model';

export default async function inactiveKnowledgeExperts(dryRun = true) {
  const api = WikiApi();
  await api.login();
  const report = await runInactiveKnowledgeExperts(api, { dryRun, botName: process.env.BOT_NAME as string });
  console.log(JSON.stringify(report));
  return report;
}

const live = botLoggerDecorator(() => inactiveKnowledgeExperts(false), {
  botName: 'תחזוקת בעלי ידע לא פעילים',
});
const preview = shabathProtectorDecorator(() => inactiveKnowledgeExperts(true));

export function main() {
  return process.env.INACTIVE_KNOWLEDGE_EXPERTS_WRITE_ENABLED === 'true' ? live() : preview();
}
