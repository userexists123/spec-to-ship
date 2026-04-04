export class AzureDevOpsClient {
  constructor(
    private readonly orgUrl: string,
    private readonly project: string
  ) {}

  getInfo() {
    return {
      orgUrl: this.orgUrl,
      project: this.project,
      status: "placeholder"
    };
  }
}