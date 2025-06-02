// Direct API calls using simple XMLHttpRequest to bypass Vite issues
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function makeRequest<T>(method: string, url: string, data?: any): Promise<APIResponse<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve({ success: true, data: response });
          } else {
            resolve({ success: false, error: `HTTP ${xhr.status}` });
          }
        } catch (error) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      }
    };
    
    xhr.onerror = function() {
      resolve({ success: false, error: 'Network error' });
    };
    
    if (data) {
      xhr.send(JSON.stringify(data));
    } else {
      xhr.send();
    }
  });
}

export async function getWhatsAppAccounts() {
  const result = await makeRequest('GET', '/api/whatsapp/accounts');
  return result.success ? result.data : [];
}

export async function createWhatsAppAccount(accountData: any) {
  const result = await makeRequest('POST', '/api/whatsapp/accounts', accountData);
  return result;
}

export async function deleteWhatsAppAccount(id: number) {
  const result = await makeRequest('DELETE', `/api/whatsapp/accounts/${id}`);
  return result;
}

export async function deleteAllWhatsAppAccounts() {
  const result = await makeRequest('DELETE', '/api/whatsapp/accounts');
  return result;
}

export async function getGeminiKeyStatus() {
  const result = await makeRequest('GET', '/api/settings/gemini-key-status');
  return result.success ? result.data : { hasValidKey: false };
}

export async function getOpenAIKeyStatus() {
  const result = await makeRequest('GET', '/api/settings/openai-key-status');
  return result.success ? result.data : { hasValidKey: false };
}