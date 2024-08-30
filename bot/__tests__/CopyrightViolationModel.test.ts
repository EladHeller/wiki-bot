// import CopyrightViolationModel, { ICopyrightViolationModel } from './CopyrightViolationModel';
// import { IWikiApi } from '../wiki/NewWikiApi';
// import { Mocked } from '../../testConfig/mocks/types';
// import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
// import { CopyViolationResponse } from '../API/copyvios';

// describe('copyrightViolationModel', () => {
//   let copyrightViolationModel: ICopyrightViolationModel;
//   let wikiApi: Mocked<IWikiApi>;
//   let mockCheckCopyViolations: jest.Mock;
//   let mockCheckHamichlol: jest.Mock;

//   const mockConfig = {
//     BASE_PAGE: 'Base_Page',
//     LAST_RUN_PAGE: 'Last_Run_Page',
//     SEARCH_ERROR_PAGE: 'Search_Error_Page',
//     LOG_PAGE: 'Log_Page',
//     SELECTED_QOUTE: 'Selected_Quote',
//     WEBSITE_FOR_VISIT: 'Website_For_Visit',
//     DRAFT: 'Draft',
//     HAMICHLOL_DOMAIN: 'https://www.hamichlol.org.il/',
//     WIKIPEDIA_DOMAIN: 'https://he.wikipedia.org/wiki/',
//   };

//   beforeEach(() => {
//     wikiApi = WikiApiMock();
//     mockCheckCopyViolations = jest.fn();
//     mockCheckHamichlol = jest.fn();
//     copyrightViolationModel = CopyrightViolationModel(wikiApi, mockCheckCopyViolations, mockCheckHamichlol, mockConfig);
//   });

//   describe('handlePage', () => {
//     it('should handle a page with no violations', async () => {
//       mockCheckCopyViolations.mockResolvedValue({ status: 'ok', best: { violation: 'none', confidence: 0 } });
//       mockCheckHamichlol.mockResolvedValue(null);

//       const result = await copyrightViolationModel.handlePage('Test_Page', true);

//       expect(result.logs).toHaveLength(0);
//       expect(result.otherLogs).toHaveLength(1);
//       expect(result.otherLogs[0].title).toBe('Test_Page');
//       expect(result.otherLogs[0].text).toContain('[[Test_Page]] 0.00');
//     });

//     it('should handle a page with violations', async () => {
//       const mockViolation: CopyViolationResponse = {
//         status: 'ok',
//         best: { violation: 'suspected', confidence: 0.8, url: 'http://example.com' },
//       };
//       mockCheckCopyViolations.mockResolvedValue(mockViolation);
//       mockCheckHamichlol.mockResolvedValue(null);

//       const result = await copyrightViolationModel.handlePage('Test_Page', true);

//       expect(result.logs).toHaveLength(1);
//       expect(result.logs[0].title).toBe('Test_Page');
//       expect(result.logs[0].text).toContain('[[Test_Page]]');
//       expect(result.logs[0].text).toContain('http://example.com');
//       expect(result.logs[0].text).toContain('0.80');
//       expect(result.logs[0].text).toContain('חשוד');
//     });

//     // Add more tests for different scenarios (disambiguation, search errors, etc.)
//   });

//   describe('handlePreviousErrors', () => {
//     it('should handle previous errors', async () => {
//       const mockHandlePage = jest.spyOn(copyrightViolationModel, 'handlePage').mockResolvedValue({
//         logs: [{ title: 'Error_Page', text: 'Error log', error: true }],
//         otherLogs: [],
//       });

//       const result = await copyrightViolationModel.handlePreviousErrors(['Error_Page']);

//       expect(mockHandlePage).toHaveBeenCalledWith('Error_Page', true);
//       expect(result.logs).toHaveLength(1);
//       expect(result.logs[0].title).toBe('Error_Page');
//       expect(result.otherLogs).toHaveLength(0);
//     });
//   });

//   describe('processPagesAndLogs', () => {
//     it('should process pages and logs', async () => {
//       wikiApi.newPages.mockReturnValue([{ title: 'New_Page', ns: 0 }]);
//       wikiApi.logs.mockReturnValue([{ title: 'Moved_Page', params: { target_ns: 0, target_title: 'New_Target' } }]);

//       const mockHandlePage = jest.spyOn(copyrightViolationModel, 'handlePage').mockResolvedValue({
//         logs: [{ title: 'New_Page', text: 'New page log' }],
//         otherLogs: [],
//       });

//       const result = await copyrightViolationModel.processPagesAndLogs('2023-01-01T00:00:00Z');

//       expect(mockHandlePage).toHaveBeenCalledWith('New_Page', true);
//       expect(mockHandlePage).toHaveBeenCalledWith('New_Target', true);
//       expect(result.allLogs).toHaveLength(2);
//       expect(result.allOtherLogs).toHaveLength(0);
//     });
//   });

//   describe('generateReportContent', () => {
//     it('should generate report content', () => {
//       const allLogs = [
//         { title: 'Page1', text: 'Log 1', rank: 0.8 },
//         { title: 'Page2', text: 'Log 2', rank: 0.6 },
//       ];
//       const allOtherLogs = [
//         { title: 'Page3', text: 'not found', error: true },
//         { title: 'Page4', text: 'disambiguation', error: false },
//       ];

//       const result = copyrightViolationModel.generateReportContent(allLogs, allOtherLogs);

//       expect(result).toHaveLength(6); // 6 paragraphs in the report
//       expect(result[0].name).toBe('דפים ללא הפרה');
//       expect(result[1].name).toBe('פירושונים');
//       // Add more assertions for other paragraphs
//     });
//   });
// });
