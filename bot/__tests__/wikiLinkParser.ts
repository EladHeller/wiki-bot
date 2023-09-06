import {
  getInnerLinks, getInnerLink, getExteranlLinks, getExteranlLink,
} from '../wiki/wikiLinkParser';

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

  it('should manage open bracket without close bracket', () => {
    const mockText = '[[Link1|Text1]] [[Link2]] [[Link3|Text3]] [[Link4';
    const expectedLinks = [
      { link: 'Link1', text: 'Text1' },
      { link: 'Link2', text: 'Link2' },
      { link: 'Link3', text: 'Text3' },
    ];

    const result = getInnerLinks(mockText);

    expect(result).toStrictEqual(expectedLinks);
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

  it('should manage open bracket without close bracket', () => {
    const mockText = '[[Link1|Text1]] [[Link2]] [[Link3|Text3]] [[Link4';
    const expectedLink = { link: 'Link1', text: 'Text1' };

    const result = getInnerLink(mockText);

    expect(result).toStrictEqual(expectedLink);
  });
});

describe('getExteranlLinks', () => {
  it('should ignore inner links', () => {
    const mockText = '[[Link1|Text1]] [https://example.com text of link] [[Link2]] [[Link3|Text3]]';

    const expectedLinks = [
      { link: 'https://example.com', text: 'text of link' },
    ];

    const result = getExteranlLinks(mockText);

    expect(result).toStrictEqual(expectedLinks);
  });

  it('should return an array of links', () => {
    const mockText = '[https://example.com text of link] [ https://other.com ] [https://third.com description]';

    const expectedLinks = [
      { link: 'https://example.com', text: 'text of link' },
      { link: 'https://other.com', text: '' },
      { link: 'https://third.com', text: 'description' },
    ];

    const result = getExteranlLinks(mockText);

    expect(result).toStrictEqual(expectedLinks);
  });

  it('should manage open bracket without close bracket', () => {
    const mockText = '[http://example.com link][http://example.com';
    const expectedLink = { link: 'http://example.com', text: 'link' };

    const result = getExteranlLinks(mockText);

    expect(result).toStrictEqual([expectedLink]);
  });

  it('should return an empty array if there are no exteranal links', () => {
    const mockText = 'No links';

    const result = getExteranlLinks(mockText);

    expect(result).toStrictEqual([]);
  });
});

describe('getExteranlLink', () => {
  it('should return the first link', () => {
    const mockText = '[https://example.com text of link] [ https://other.com ] [https://third.com description]';
    const expectedLink = { link: 'https://example.com', text: 'text of link' };

    const result = getExteranlLink(mockText);

    expect(result).toStrictEqual(expectedLink);
  });

  it('should return undefined if there are no exteranal links', () => {
    const mockText = 'No links';

    const result = getExteranlLink(mockText);

    expect(result).toBeUndefined();
  });

  it('should manage open bracket without close bracket', () => {
    const mockText = '[http://example.com link][http://example.com';
    const expectedLink = { link: 'http://example.com', text: 'link' };

    const result = getExteranlLink(mockText);

    expect(result).toStrictEqual(expectedLink);
  });
});
