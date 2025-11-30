import type { LanguageClient } from 'vscode-languageclient/node';

let _client: LanguageClient | undefined;

export function setClient(client: LanguageClient) {
  _client = client;
}

export function getClient(): LanguageClient {
  if (!_client) {throw new Error('LanguageClient not initialized. Call setClient() in activate().');}
  return _client;
}