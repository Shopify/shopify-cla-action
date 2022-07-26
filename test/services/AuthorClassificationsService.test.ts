import AuthorClassificationService from '../../src/services/AuthorClassificationService';
import Author from '../../src/model/Author';

const httpGetJsonMock = jest.fn();

jest.mock('@actions/http-client', () => ({
  HttpClient: jest.fn().mockImplementation(() => {
    return {getJson: httpGetJsonMock, getAgent: jest.fn()};
  }),
}));

const signedAuthors = [
  new Author(
    'Good Noname',
    'signed-user@email.com',
    12313213123,
    'signed-user',
  ),
];

function setClaServiceResponse(data: any, error = false) {
  httpGetJsonMock.mockImplementationOnce(() => {
    return Promise[error ? 'reject' : 'resolve']({
      result: data,
    });
  });
}

describe('AuthorClassificationService (cla.shopify.com)', () => {
  it('should properly classify authors', async () => {
    const service = new AuthorClassificationService(
      'cla.shopify.com',
      'secret',
    );

    setClaServiceResponse({signedUsernames: ['signed-user']});

    const response = await service.classify(signedAuthors);

    expect(response.valid).toStrictEqual(signedAuthors);
  });

  it('should retry if the request failed', async () => {
    const service = new AuthorClassificationService(
      'cla.shopify.com',
      'secret',
      3,
      100,
    );

    setClaServiceResponse(undefined, true);
    setClaServiceResponse({signedUsernames: ['signed-user']});

    const response = await service.classify(signedAuthors);

    expect(httpGetJsonMock).toHaveBeenCalledTimes(2);
    expect(response.valid).toStrictEqual(signedAuthors);
  });
});
