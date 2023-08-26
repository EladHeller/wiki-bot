import { findTemplates, getTemplateArrayData } from '../wiki/newTemplateParser';

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
});
