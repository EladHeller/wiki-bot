import { promiseSequence } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

const CATEGORY_NAME = 'AI-generated images';

export interface IAiGeneratedImagesModel {
  getAiGeneratedImagesFromCommons(): Promise<Map<string, string[]>>;
}

async function getFilesWithGlobalUsageInSubcategory(
  commonsApi: IWikiApi,
  category: string,
  pagesWithAiImages: Map<string, string[]>,
) {
  const resultGenerator = commonsApi.filesWithGlobalUsage(category, 'hewiki');

  for await (const files of resultGenerator) {
    for (const file of files) {
      const { globalusage } = file;
      if (globalusage) {
        for (const usage of globalusage) {
          if (usage.wiki === 'he.wikipedia.org' && usage.title) {
            if (!pagesWithAiImages.has(usage.title)) {
              pagesWithAiImages.set(usage.title, []);
            }
            const images = pagesWithAiImages.get(usage.title);
            if (images && !images.includes(file.title)) {
              images.push(file.title);
            }
          }
        }
      }
    }
  }
}

export default function AiGeneratedImagesModel(commonsApi: IWikiApi): IAiGeneratedImagesModel {
  return {
    async getAiGeneratedImagesFromCommons() {
      const pagesWithAiImages = new Map<string, string[]>();
      const categories = [CATEGORY_NAME];

      for await (const subCategory of commonsApi.recursiveSubCategories(CATEGORY_NAME)) {
        categories.push(subCategory.title.replace(/^(Category|קטגוריה):/i, ''));
      }
      await promiseSequence(10, categories.map(
        (cat) => () => getFilesWithGlobalUsageInSubcategory(commonsApi, cat, pagesWithAiImages),
      ));

      return pagesWithAiImages;
    },
  };
}
