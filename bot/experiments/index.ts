import WikiApi from '../wiki/WikiApi';

// eslint-disable-next-line no-empty-function
async function main() {
  const api = WikiApi();
  await api.login();
  const { content } = await api.articleContent('תבנית:אבדות במלחמת חרבות ברזל/נתונים');
  console.log(content);
}
main();
