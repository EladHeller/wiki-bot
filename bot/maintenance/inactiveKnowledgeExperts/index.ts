import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi from '../../wiki/WikiApi';
import runInactiveKnowledgeExperts from './model';

export default async function inactiveKnowledgeExperts() {
  const api = WikiApi();
  await api.login();
  const report = await runInactiveKnowledgeExperts(api, {
    dryRun: process.env.INACTIVE_KNOWLEDGE_EXPERTS_WRITE_ENABLED !== 'true',
  });
  console.log(JSON.stringify(report));
  return report;
}

export const main = botLoggerDecorator(inactiveKnowledgeExperts, {
  botName: 'תחזוקת בעלי ידע לא פעילים',
});
