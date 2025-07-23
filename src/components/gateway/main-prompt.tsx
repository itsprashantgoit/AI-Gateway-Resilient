"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Model } from './models';
import { EventSourcePolyfill } from 'event-source-polyfill';


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
                conversation_id: "local-test-session",
                stream: stream
            });
        } else { // image
            apiUrl = "/api/v1/images/generations";
            body = JSON.stringify({
                model: modelId,
                prompt: prompt,
                n: 1,
                steps: selectedModel.steps,
                response_format: "b64_json"
            });
        }

        try {
            if (selectedModel.type === 'chat' && stream) {
                setStatus({ message: 'Streaming response...', type: '' });
                let fullResponse = '';
                const eventSource = new EventSourcePolyfill(apiUrl, {
                    headers: headers,
                    payload: body,
                    method: 'POST',
                    withCredentials: false
                });

                eventSource.onmessage = function(event) {
                    let data = event.data;
                    if (data === '[DONE]' || !data) return;
                    try {
                        const json = JSON.parse(data);
                        if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                            fullResponse += json.choices[0].delta.content;
                            setResponse({ type: 'chat', content: fullResponse });
                        }
                    } catch (e) {
                        // Ignore non-JSON lines
                    }
                };
                eventSource.onerror = function(err) {
                    setStatus({ message: 'Streaming error.', type: 'error' });
                    eventSource.close();
                    setIsLoading(false);
                };
                eventSource.onopen = function() {
                    setStatus({ message: 'Streaming started...', type: '' });
                };
                eventSource.addEventListener('end', function() {
                    setStatus({ message: 'Streaming complete!', type: 'success' });
                    setIsLoading(false);
                    eventSource.close();
                });

            } else {
                const res = await fetch(apiUrl, { method: 'POST', headers: headers, body: body });
                const data = await res.json();

                if (!res.ok) {
                    let errorMessage = data?.error || `An unknown error occurred. Status: ${res.status}`;
                    if(data.provider_error) errorMessage += ` - Provider: ${data.provider_error.error.message}`;
                    throw new Error(`Gateway Error (${res.status}): ${errorMessage}`);
                }
                setStatus({ message: `Success!`, type: 'success' });

                if (selectedModel.type === 'chat') {
                    setResponse({ type: 'chat', content: data.choices[0].message.content });
                } else { // image
                    if (data.data && data.data[0] && data.data[0].b64_json) {
                       setResponse({ type: 'image', content: data.data[0].b64_json, alt: prompt });
                    } else {
                        console.error("Full API response:", data);
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
