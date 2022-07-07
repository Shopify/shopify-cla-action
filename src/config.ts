export const config = {
  errorMessages: {
    requestKnownUsers:
      '{{usernames}}: [Sign the CLA]({{claUrl}}) to have your PR reviewed.',
    requestUnknownUsers:
      '{{emails}}: Connect your email address with a GitHub account and [sign the CLA]({{claUrl}}) to have your PR reviewed.',
    welcome:
      'In order to merge this pull request, all contributors must sign [Shopify’s CLA]({{claUrl}}).',
  },
  successMessages: {
    welcome: 'All contributors have signed and are covered by Shopify’s CLA.',
  },
  label: 'cla-needed',
  claUrl: 'https://cla.shopify.com',
};
