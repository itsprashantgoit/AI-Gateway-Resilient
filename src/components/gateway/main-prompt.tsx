
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Model } from './models';

interface MainPromptProps {
    models: Model[];
    setStatus: (status: { message: string; type: string }) => void;
    setResponse: (response: any) => void;
    setIsLoading: (isLoading: boolean) => void;
    isLoading: boolean;
}

export function MainPrompt({ models, setStatus, setResponse, setIsLoading, isLoading }: MainPromptProps) {
    const [modelId, setModelId] = useState<string>(models[0].id);
    const [prompt, setPrompt] = useState('');
    const [stream, setStream] = useState(true);

    const handleSend = async () => {
        const selectedModel = models.find(m => m.id === modelId);
        if (!selectedModel || !prompt.trim()) {
            alert('Please select a model and provide a prompt.');
            return;
        }

        setIsLoading(true);
        setStatus({ message: `Querying gateway for ${modelId}...`, type: '' });
        setResponse(null);

        const headers = { 'Content-Type': 'application/json' };
        let body, apiUrl;

        if (selectedModel.type === 'chat') {
            apiUrl = "/api/v1/chat/completions";
            body = JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: prompt }],
                stream: stream
            });
        } else { // image
            apiUrl = "/api/v1/images/generations";
            body = JSON.stringify({
                model: modelId,
                prompt: prompt,
                n: 1,
                steps: selectedModel.steps
            });
        }

        try {
            if (selectedModel.type === 'chat' && stream) {
                setStatus({ message: 'Streaming response...', type: '' });
                let fullResponse = '';
                
                const response = await fetch(apiUrl, { method: 'POST', headers: headers, body: body });

                if (!response.ok) {
                    const errorJson = await response.json();
                    throw new Error(`Gateway Error (${response.status}): ${errorJson.error?.message || JSON.stringify(errorJson)}`);
                }

                if (!response.body) {
                    throw new Error("Response body is null");
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let keyId = '';
                let rateLimitInfo = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setStatus({ message: 'Streaming complete!', type: 'success' });
                        setIsLoading(false);
                        break;
                    }
                    buffer += decoder.decode(value, {stream: true});
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep the last, potentially incomplete line
                    
                    for (const line of lines) {
                        if (line.trim().startsWith('event: metadata')) {
                            const dataLine = lines.find(l => l.startsWith('data:'));
                            if(dataLine) {
                                const data = dataLine.substring(5).trim();
                                try {
                                    const json = JSON.parse(data);
                                    keyId = json.keyId;
                                    rateLimitInfo = json.rateLimitInfo;
                                    setResponse((prev: any) => ({ ...prev, type: 'chat', keyId, rateLimitInfo }));
                                } catch (e) {
                                    console.log("Error parsing keyId from stream", data);
                                }
                            }
                            continue;
                        }
                        if (line.trim().startsWith('data:')) {
                            const data = line.substring(5).trim();
                            if (data === '[DONE]') {
                                break;
                            }
                            try {
                                const json = JSON.parse(data);
                                if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                                    fullResponse += json.choices[0].delta.content;
                                    setResponse((prev: any) => ({ ...prev, type: 'chat', content: fullResponse, keyId, rateLimitInfo }));
                                }
                            } catch (e) {
                                // This can happen with incomplete JSON objects, so we'll just log and continue
                                console.log('Skipping incomplete JSON chunk:', data);
                            }
                        }
                    }
                }

            } else {
                const res = await fetch(apiUrl, { method: 'POST', headers: headers, body: body });
                const data = await res.json();

                if (!res.ok) {
                    let errorMessage = data?.error?.message || data?.error || `An unknown error occurred. Status: ${res.status}`;
                    if(data.provider_error) errorMessage += ` - Provider: ${data.provider_error.error.message}`;
                    throw new Error(`Gateway Error (${res.status}): ${errorMessage}`);
                }
                setStatus({ message: `Success!`, type: 'success' });

                if (selectedModel.type === 'chat') {
                    setResponse({ type: 'chat', content: data.choices[0].message.content, keyId: data.keyId, rateLimitInfo: data.rateLimitInfo });
                } else { // image
                    const b64_json = data?.data?.[0]?.b64_json;
                    if (b64_json) {
                       setResponse({ type: 'image', content: b64_json, alt: prompt, keyId: data.keyId, rateLimitInfo: data.rateLimitInfo });
                    } else {
                        console.error("Full API response for debugging:", data);
                        throw new Error("Image data (b64_json) not found in the API response.");
                    }
                }
                setIsLoading(false);
            }
        } catch (error: any) {
            console.error('Fetch Error:', error);
            setResponse({ type: 'error', content: `An error occurred: ${error.message}` });
            setStatus({ message: 'Request failed.', type: 'error' });
            setIsLoading(false);
        }
    };
    
    return (
        <div className="mb-8 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Main Prompt</h2>
            <Select onValueChange={setModelId} defaultValue={modelId}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                    {models.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                            {model.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Textarea 
                placeholder="Enter prompt here..." 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="my-2"
            />
            <div className="flex items-center space-x-2 my-2">
                <Checkbox id="streamCheckbox" checked={stream} onCheckedChange={(checked) => setStream(Boolean(checked))} />
                <Label htmlFor="streamCheckbox">Stream Response</Label>
            </div>
            <Button onClick={handleSend} disabled={isLoading}>Send</Button>
        </div>
    )
}
