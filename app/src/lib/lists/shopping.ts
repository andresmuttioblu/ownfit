/** A plain Google Shopping search for an item: no scraping, no API, no affiliate parameters. */
export const shoppingUrl = (name: string) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name)}`;
