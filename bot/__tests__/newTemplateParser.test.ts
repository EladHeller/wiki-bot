import {
  findTemplate,
  findTemplates, getTemplateArrayData, getTemplateKeyValueData, templateFromArrayData,
  templateFromKeyValueData,
} from '../wiki/newTemplateParser';

describe('findTemplates', () => {
  it('should return empty array if no templates found', () => {
    const text = 'hello world';
    const templateName = 'test';
    const title = 'test';
    const result = findTemplates(text, templateName, title);
    expect(result).toStrictEqual([]);
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
