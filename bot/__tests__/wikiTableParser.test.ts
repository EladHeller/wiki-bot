import { describe, expect, it } from '@jest/globals';
import parseTableText, {
  buildTable,
  buildTableRow,
  buildTableWithStyle,
  TableRow,
} from '../wiki/wikiTableParser';

describe('wikiTableParser', () => {
  describe('parseTableText', () => {
    it('should parse simple table', () => {
      const input = '{| class="wikitable"\n! Header1 !! Header2\n|-\n| Data1 || Data2\n|}';
      const result = parseTableText(input);

      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(2);
      expect(result[0].rows[0].fields).toStrictEqual(['Header1', 'Header2']);
      expect(result[0].rows[1].fields).toStrictEqual(['Data1', 'Data2']);
    });

    it('should parse table with 6 rows', () => {
      const input = '{| class="wikitable"\n! Header1 !! Header2\n|-\n| Data1 || Data2\n|-\n| Data3 || Data4\n|-\n| Data5 || Data6\n|-\n| Data7 || Data8\n|-\n| Data9 || Data10\n|}';
      const result = parseTableText(input);

      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(6);
    });

    it('should parse table with new lines in middle of row', () => {
      const input = '{| class="wikitable"\n! Header1 !! Header2\n|-\n| Data1 || Data2 \n|| Data3 || Data4\n|-\n| Data5 || Data6 || Data7 || Data8\n|-\n| Data9 || Data10\n|}';
      const result = parseTableText(input);

      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(4);
    });

    it('should parse multiple tables', () => {
      const input = '{| class="table1"\n|data1\n|}{| class="table2"\n|data2\n|}';
      const result = parseTableText(input);

      expect(result).toHaveLength(2);
    });
  });

  describe('buildTableRow', () => {
    it('should build regular row', () => {
      const fields = ['Col1', 'Col2'];
      const result = buildTableRow(fields);

      expect(result).toBe('\n|-\n|Col1 || Col2');
    });

    it('should build header row', () => {
      const fields = ['Header1', 'Header2'];
      const result = buildTableRow(fields, undefined, true);

      expect(result).toBe('\n|-\n!Header1 || Header2');
    });

    it('should handle null values', () => {
      const fields = ['Col1', null];
      const result = buildTableRow(fields);

      expect(result).toBe('\n|-\n|Col1 || ---');
    });
  });

  describe('buildTable', () => {
    it('should build complete table', () => {
      const headers = ['H1', 'H2'];
      const rows = [['D1', 'D2'], ['D3', 'D4']];
      const result = buildTable(headers, rows);

      expect(result).toContain('class="wikitable sortable"');
      expect(result).toContain('! H1 !! H2');
      expect(result).toContain('|D1 || D2');
    });

    it('should build not sortable table', () => {
      const headers = ['H1', 'H2'];
      const rows = [['D1', 'D2'], ['D3', 'D4']];
      const result = buildTable(headers, rows, false);

      expect(result).toContain('class="wikitable"');
    });
  });

  describe('buildTableWithStyle', () => {
    it('should build table with styled rows', () => {
      const headers = ['H1', 'H2'];
      const rows: TableRow[] = [
        { fields: ['D1', 'D2'], style: 'style="background: red"' },
      ];
      const result = buildTableWithStyle(headers, rows);

      expect(result).toContain('style="background: red"');
      expect(result).toContain('|D1 || D2');
    });
  });

  describe('edge cases', () => {
    it('should handle table with only header', () => {
      const input = '{| class="wikitable"\n! Header1 !! Header2\n|}';
      const result = parseTableText(input);

      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(1);
    });
  });
});
