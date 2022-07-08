export default class Author {
  constructor(name: string, email: string, id?: number, login?: string) {
    this.name = name;
    this.email = email;
    this.id = id;
    this.login = login;
    this.hasGithubAccount = this.id !== undefined;
  }

  public readonly name: string;
  public readonly email: string;
  public readonly id?: number;
  public readonly login?: string;
  public readonly hasGithubAccount: boolean;

  get formattedLogin() {
    return `@${this.login}`;
  }

  get formattedCommitterLine() {
    return `\`${this.name} <${this.email}>\``;
  }
}
