import { WikiPage } from '../../types';
import { IWikiApi } from '../../wiki/WikiApi';

const CATEGORY_NAME = 'AI-generated images';

interface GlobalUsage {
  title: string;
  wiki: string;
  url: string;
}

interface FileWithGlobalUsage extends WikiPage {
  globalusage?: GlobalUsage[];
}

export interface IAiGeneratedImagesModel {
  getAiGeneratedImagesFromCommons(): Promise<Record<string, string[]>>;
}

async function getFilesWithGlobalUsageInSubcategory(
  commonsApi: IWikiApi,
  category: string,
  pagesWithAiImages: Record<string, string[]>,
) {
  const path = `?action=query&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmtype=file&gcmlimit=500&prop=globalusage&gusite=hewiki&format=json`;
  const resultGenerator = commonsApi.continueQuery(path, (res: any) => {
    const pages = res?.query?.pages;
    if (pages) {
      return Object.values(pages);
    }
    return [];
  });

  const currentPagesWithAiImages = pagesWithAiImages;

  for await (const files of resultGenerator) {
    for (const file of (files as FileWithGlobalUsage[])) {
      const { globalusage } = file;
      if (globalusage) {
        for (const usage of globalusage) {
          if (usage.wiki === 'hewiki' && usage.title) {
            if (!currentPagesWithAiImages[usage.title]) {
              currentPagesWithAiImages[usage.title] = [];
            }
            if (!currentPagesWithAiImages[usage.title].includes(file.title)) {
              currentPagesWithAiImages[usage.title].push(file.title);
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
      const pagesWithAiImages: Record<string, string[]> = {};
      const seenCategories = new Set<string>();
      const queue: string[] = [CATEGORY_NAME];
      const CONCURRENCY = 10;

      const processQueue = async () => {
        let category = queue.pop();
        while (category) {
          if (!seenCategories.has(category)) {
            seenCategories.add(category);

            await getFilesWithGlobalUsageInSubcategory(commonsApi, category, pagesWithAiImages);

            const subCatsGenerator = commonsApi.listCategory(category, 500, 'subcat');
            for await (const subCats of subCatsGenerator) {
              for (const subCat of subCats) {
                const subCatName = subCat.title.replace(/^Category:/, '');
                queue.push(subCatName);
              }
            }
          }
          category = queue.pop();
        }
      };

      // Run multiple workers
      await Promise.all(Array.from({ length: CONCURRENCY }, () => processQueue()));

      return pagesWithAiImages;
    },
  };
}
