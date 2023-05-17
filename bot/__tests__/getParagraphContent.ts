import { getParagraphContent, getUsersFromTagParagraph } from '../wiki/paragraphParser';

describe('getParagraphContent', () => {
  it('should return the content of a paragraph when it exists in the article text', () => {
    const articleText = `
      Some text before
      ==Introduction==
      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      ==Conclusion==
      Donec nec enim sed metus consequat aliquet.
      Some text after
    `;
    const paragraphName = 'Introduction';
    const expectedContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

    const result = getParagraphContent(articleText, paragraphName);

    expect(result).toStrictEqual(expectedContent);
  });

  it('should return the content of a paragraph when it at the end of the article', () => {
    const articleText = `
      Some text before
      ==Introduction==
      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      ==Conclusion==
      Donec nec enim sed metus consequat aliquet.
      Some text after
    `;
    const paragraphName = 'Conclusion';
    const expectedContent = `Donec nec enim sed metus consequat aliquet.
      Some text after`;

    const result = getParagraphContent(articleText, paragraphName);

    expect(result).toStrictEqual(expectedContent);
  });

  it('should return null when the paragraph does not exist in the article text', () => {
    const articleText = `
      Some text before
      ==Introduction==
      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      ==Conclusion==
      Donec nec enim sed metus consequat aliquet.
      Some text after
    `;
    const paragraphName = 'Body';

    const result = getParagraphContent(articleText, paragraphName);

    expect(result).toBeNull();
  });
});

describe('getUsersFromTagParagraph', () => {
  it('should return an array of users when the tag paragraph exists in the article content', () => {
    const articleContent = `
      Some text before
      ==Tag==
      [[משתמש:User1]]
      [[user:User2|User 2]]
      * [[משתמש:User3|User 3]]
      Some text after
    `;
    const paragraphName = 'Tag';
    const expectedUsers = [
      '[[משתמש:User1]]',
      '[[user:User2|User 2]]',
      '[[משתמש:User3|User 3]]',
    ];

    const result = getUsersFromTagParagraph(articleContent, paragraphName);

    expect(result).toStrictEqual(expectedUsers);
  });

  it('should return an empty array when the tag paragraph does not exist in the article content', () => {
    const articleContent = `
      Some text before
      ==Tag==
      Some text after
    `;
    const paragraphName = 'Users';

    const result = getUsersFromTagParagraph(articleContent, paragraphName);

    expect(result).toStrictEqual([]);
  });
});
