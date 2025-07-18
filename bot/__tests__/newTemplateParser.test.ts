import { describe, expect, it } from '@jest/globals';
import {
  findTemplate, findTemplates, getTemplateArrayData, getTemplateData, getTemplateKeyValueData,
  templateFromArrayData, templateFromKeyValueData, templateFromTemplateData,
} from '../wiki/newTemplateParser';

describe('findTemplates', () => {
  it('should return empty array if no templates found', () => {
    const text = 'hello world';
    const templateName = 'test';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual([]);
  });

  it('should handle templates without paramaters', () => {
    const text = 'text with {{template}}';
    const templateName = 'template';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual(['{{template}}']);
  });

  it('should return array of templates if templates found', () => {
    const text = 'hello world {{template| test}}';
    const templateName = 'template';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual(['{{template| test}}']);
  });

  it('should find template in another template', () => {
    const text = 'hello world {{template| {{test|text=hello}}{{a}}|test2}}';
    const templateName = 'test';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual(['{{test|text=hello}}']);
  });

  it('should find multiple templates', () => {
    const text = 'hello world {{template| {{test|text=hello}}{{a}}|test2}} lorem ipsum {{test|text=world}} dilor';
    const templateName = 'test';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual(['{{test|text=hello}}', '{{test|text=world}}']);
  });

  it('should not return templates that starts with template name', () => {
    const text = 'hello world {{template1| test}}';
    const templateName = 'template';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual([]);
  });

  it('regression test edge case: template starts with template name and includes the template', () => {
    const text = `{{תרגומים|
* איטלקית: {{ת|איטלקית|barbiere}}
* אנגלית: {{ת|אנגלית|barber}}
* גרמנית: {{ת|גרמנית|Friseur}}
* לטינית: {{ת|לטינית|tonsor}}
|
* ספרדית: '''{{ת|ספרדית|peluquero}}''' <small>(זכר; נקבה: '''{{ת|ספרדית|peluquera}}''')</small>
* ערבית: {{ת|ערבית|مزين|حلاق}}
* צרפתית: {{ת|צרפתית|coiffeur}}
* רוסית: {{ת|רוסית|брадобрей}}
}}
`;
    const templateName = 'ת';
    const title = 'test';
    const result = findTemplates(text, templateName, title);

    expect(result).toStrictEqual([]);
  });

  it('regression test should find swtich template', () => {
    const text = `{{#switch: {{{1}}}
|data=value
}}`;
    const template = findTemplate(text, '#switch: {{{1}}}', 'test');

    expect(template).toStrictEqual(text);
  });

  it('should manage broken template', () => {
    const text = 'hello {{test|text=hello}} {{test|text=world';

    const result = findTemplates(text, 'test', 'test');

    expect(result).toStrictEqual(['{{test|text=hello}}']);
  });
});

describe('findTemplate', () => {
  const templateName = 'test';
  const title = 'test';

  it('should finds first template', () => {
    const text = 'hello world {{template| {{test|text=hello}}{{a}}|test2}} lorem ipsum {{test|text=world}} dilor';
    const result = findTemplate(text, templateName, title);

    expect(result).toBe('{{test|text=hello}}');
  });

  it('should returns empty string if no template found', () => {
    const text = 'hello world';
    const result = findTemplate(text, templateName, title);

    expect(result).toBe('');
  });
});

describe('getTemplateArrayData', () => {
  it('should return empty array if no template found', () => {
    const result = getTemplateArrayData('', 'test');

    expect(result).toStrictEqual([]);
  });

  it('should return array of template data', () => {
    const result = getTemplateArrayData('{{test|text=hello}}', 'test');

    expect(result).toStrictEqual(['text=hello']);
  });

  it('should return array of template data with multiple values', () => {
    const result = getTemplateArrayData('{{test|text=hello|test=world}}', 'test');

    expect(result).toStrictEqual(['text=hello', 'test=world']);
  });

  it('should return array of template data with multiple values and new lines', () => {
    const result = getTemplateArrayData('{{test\n|text=hello|test=world\n}}', 'test');

    expect(result).toStrictEqual(['text=hello', 'test=world']);
  });

  it('should ignore pipe sign in template value', () => {
    const result = getTemplateArrayData('{{test|[[text|hello]]|{{other|wor}}|ld}}', 'test');

    expect(result).toStrictEqual(['[[text|hello]]', '{{other|wor}}', 'ld']);
  });

  it('should ignore named params if parameter passed', () => {
    const result = getTemplateArrayData('{{test|text|text=hello|test=world|other}}', 'test', 'text', true);

    expect(result).toStrictEqual(['text', 'other']);
  });

  it('should not ignore number parameters', () => {
    const result = getTemplateArrayData('{{test|1=hello|2=world}}', 'test', 'text', true);

    expect(result).toStrictEqual(['hello', 'world']);
  });

  it('should mix number and regular parameters', () => {
    const result = getTemplateArrayData('{{test|boo|1=hello|2=world|baz|bar|3=win}}', 'test', 'text', true);

    expect(result).toStrictEqual(['hello', 'baz', 'win']);
  });

  it('should not ignore empty parameters', () => {
    const result = getTemplateArrayData('{{test||other}}', 'test', 'text');

    expect(result).toStrictEqual(['', 'other']);
  });
});

describe('templateFromArrayData', () => {
  it('shoud creates template from array data', () => {
    const array = ['text=hello', '', 'test', ''];

    const result = templateFromArrayData(array, 'test');

    expect(result).toBe('{{test|text=hello||test|}}');
  });
});

describe('templateFromKeyValueData', () => {
  it('shoud creates template from key value data', () => {
    const data = {
      test: 'hello',
      other: 'world',
    };

    const result = templateFromKeyValueData(data, 'test');

    expect(result).toBe('{{test\n|test=hello\n|other=world\n}}');
  });

  it('shoud creates oneline template if parameter passed', () => {
    const data = {
      test: 'hello',
      other: 'world',
      author: '',
    };

    const result = templateFromKeyValueData(data, 'test', false);

    expect(result).toBe('{{test|test=hello|other=world|author=}}');
  });
});

describe('getTemplateKeyValueData', () => {
  it('should get key value data from template', () => {
    const template = '{{test|text=hello|other=world|empty=|1=1}}';

    const result = getTemplateKeyValueData(template);

    expect(result).toStrictEqual({
      text: 'hello',
      other: 'world',
      empty: '',
      1: '1',
    });
  });

  it('should handle empty template', () => {
    const result = getTemplateKeyValueData('');

    expect(result).toStrictEqual({});
  });
});

describe('getTemplateData', () => {
  it('should return an empty object for a template without valid content', () => {
    const templateText = '{{templateName}}';
    const templateName = 'name';
    const title = 'Title';
    const result = getTemplateData(templateText, templateName, title);

    expect(result).toStrictEqual({});
  });

  it('should parse key-value pairs from a valid template', () => {
    const templateText = '{{name|key1=value1|key2=value2}}';
    const templateName = 'name';
    const title = 'Title';
    const result = getTemplateData(templateText, templateName, title);

    expect(result.keyValueData).toStrictEqual({
      key1: 'value1',
      key2: 'value2',
    });
    expect(result.arrayData).toStrictEqual([]);
  });

  it('should parse array data from a valid template', () => {
    const templateText = '{{name|value1|value2|value3|}}';
    const templateName = 'name';
    const title = 'Title';
    const result = getTemplateData(templateText, templateName, title);

    expect(result.keyValueData).toStrictEqual({});
    expect(result.arrayData).toStrictEqual(['value1', 'value2', 'value3', '']);
  });

  it('should handle ordered array data with numeric keys', () => {
    const templateText = '{{name|1=value1|2=value2|3=value3|otherValue1}}';
    const templateName = 'name';
    const title = 'Title';
    const result = getTemplateData(templateText, templateName, title);

    expect(result.keyValueData).toStrictEqual({});
    expect(result.arrayData).toStrictEqual(['otherValue1', 'value2', 'value3']);
  });

  it('should handle mixed content with key-value pairs and array data', () => {
    const templateText = '{{name|key1=value1|value1|2=value2}}';
    const templateName = 'name';
    const title = 'Title';
    const result = getTemplateData(templateText, templateName, title);

    expect(result.keyValueData).toStrictEqual({
      key1: 'value1',
    });
    expect(result.arrayData).toStrictEqual(['value1', 'value2']);
  });
});

describe('templateFromTemplateData', () => {
  it('should generate a valid template from an empty templateData object', () => {
    const templateData = {};
    const templateName = 'name';
    const result = templateFromTemplateData(templateData, templateName);

    expect(result).toBe('{{name}}');
  });

  it('should generate a valid template from templateData with arrayData', () => {
    const templateData = { arrayData: ['value1', 'value2', 'value3'] };
    const templateName = 'name';
    const result = templateFromTemplateData(templateData, templateName);

    expect(result).toBe('{{name|value1|value2|value3}}');
  });

  it('should generate a valid template from templateData with keyValueData', () => {
    const templateData = { keyValueData: { key1: 'value1', key2: 'value2' } };
    const templateName = 'name';
    const result = templateFromTemplateData(templateData, templateName);

    expect(result).toBe('{{name|key1=value1|key2=value2}}');
  });

  it('should generate a valid template from templateData with both arrayData and keyValueData', () => {
    const templateData = {
      arrayData: ['value1', 'value2'],
      keyValueData: { key1: 'value1', key2: 'value2' },
    };
    const templateName = 'name';
    const result = templateFromTemplateData(templateData, templateName);

    expect(result).toBe('{{name|value1|value2|key1=value1|key2=value2}}');
  });

  it('should handle special characters in key-value pairs', () => {
    const templateData = { keyValueData: { 'special-key': 'special=value' } };
    const templateName = 'name';
    const result = templateFromTemplateData(templateData, templateName);

    expect(result).toBe('{{name|special-key=special=value}}');
  });
});
