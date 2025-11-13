import {
  beforeEach, describe, expect, it,
} from '@jest/globals';
import { getArchiveTitle, getLastActiveArchiveLink } from '../utilities/archiveUtils';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('archiveUtils', () => {
  let wikiApi: Mocked<IWikiApi>;

  beforeEach(() => {
    wikiApi = WikiApiMock();
  });

  describe('getLastActiveArchiveLink', () => {
    it('should return the last active archive link', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[/ארכיון 2]]
[[/ארכיון 3]]
`;

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('TestPage/ארכיון 2');
    });

    it('should return null when no active archive found', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[/ארכיון 2]]
`;

      wikiApi.info.mockResolvedValue([{ missing: '' }]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBeNull();
    });

    it('should skip non-matching prefixes when matchPrefix is true', async () => {
      const archiveBoxContent = `
[[OtherPage/ארכיון 1]]
[[/ארכיון 1]]
[[/ארכיון 2]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', true);

      expect(result).toBe('TestPage/ארכיון 2');
      expect(wikiApi.info).toHaveBeenCalledTimes(1);
      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 2']);
    });

    it('should check all links when matchPrefix is false', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[OtherPage/ארכיון 1]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('OtherPage/ארכיון 1');
    });

    it('should handle absolute links', async () => {
      const archiveBoxContent = `
[[OtherPage/ארכיון 1]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('OtherPage/ארכיון 1');
    });

    it('should use default matchPrefix value of false', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[OtherPage/ארכיון 1]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage');

      expect(result).toBe('OtherPage/ארכיון 1');
    });

    it('should return null when matchPrefix is true and no links match the prefix', async () => {
      const archiveBoxContent = `
[[OtherPage/ארכיון 1]]
[[SomePage/ארכיון 2]]
[[DifferentPage/ארכיון 3]]
`;

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', true);

      expect(result).toBeNull();
      expect(wikiApi.info).not.toHaveBeenCalled();
    });
  });

  describe('getArchiveTitle', () => {
    it('should return archive title when archive box exists', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
[[/ארכיון 2]]
}}
Some content
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ archiveTitle: 'TestPage/ארכיון 2' });
    });

    it('should return error when archive box not found', async () => {
      const pageContent = 'No archive box here';

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ error: 'תיבת ארכיון לא נמצאה' });
    });

    it('should return error when archive box content is empty', async () => {
      const pageContent = '{{תיבת ארכיון}}';

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ error: 'התוכן של תיבת הארכיון לא נמצא' });
    });

    it('should return error when no active archive found', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ error: 'לא נמצא דף ארכיון פעיל' });
    });

    it('should use matchPrefix when specified', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[OtherPage/ארכיון 1]]
[[/ארכיון 1]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', true);

      expect(result).toStrictEqual({ archiveTitle: 'TestPage/ארכיון 1' });
      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 1']);
    });

    it('should use default matchPrefix value of false', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
[[OtherPage/ארכיון 1]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage');

      expect(result).toStrictEqual({ archiveTitle: 'OtherPage/ארכיון 1' });
    });
  });
});
