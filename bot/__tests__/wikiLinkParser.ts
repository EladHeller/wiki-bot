import { getInnerLinks, getInnerLink } from '../wiki/wikiLinkParser';

describe('getInnerLinks', () => {
  it('should return an array of InnerLink objects', () => {
    const mockText = '[[Link1|Text1]] [[Link2]] [[Link3|Text3]]';
    const expectedLinks = [
      { link: 'Link1', text: 'Text1' },
      { link: 'Link2', text: 'Link2' },
      { link: 'Link3', text: 'Text3' },
    ];

    const result = getInnerLinks(mockText);

    expect(result).toStrictEqual(expectedLinks);
  });

  it('should return an empty array if there are no inner links', () => {
    const mockText = 'No inner links';

    const result = getInnerLinks(mockText);

    expect(result).toStrictEqual([]);
  });
});

describe('getInnerLink', () => {
  it('should return the first InnerLink object', () => {
    const mockText = '[[Link1|Text1]] [[Link2]]';
    const expectedLink = { link: 'Link1', text: 'Text1' };

    const result = getInnerLink(mockText);

    expect(result).toStrictEqual(expectedLink);
  });

  it('should return undefined if there are no inner links', () => {
    const mockText = 'No inner links';

    const result = getInnerLink(mockText);

    expect(result).toBeUndefined();
  });

  it('should get links even they are in template text', () => {
    const mockText = '{{תבנית|שם=שם|שם בשפת המקור=[[שם בשפת המקור]]|אלבום=אלבום}}';
    const expectedLink = { link: 'שם בשפת המקור', text: 'שם בשפת המקור' };

    const result = getInnerLink(mockText);

    expect(result).toStrictEqual(expectedLink);
  });
});
