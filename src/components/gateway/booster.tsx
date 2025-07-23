
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Model } from './models';

interface BoosterProps {
    models: Model[];
    setStatus: (status: { message: string; type: string }) => void;
    setResponse: (response: any) => void;
    setIsLoading: (isLoading: boolean) => void;
    isLoading: boolean;
}

export function Booster({ models, setStatus, setResponse, setIsLoading, isLoading }: BoosterProps) {
    const chatModels = models.filter(m => m.type === 'chat');
    const [prompts, setPrompts] = useState('');
    const [modelId, setModelId] = useState<string | undefined>(chatModels[0]?.id);
    const [stream, setStream] = useState(true);

    const handleBoost = async () => {
        if (!modelId) {
            alert('Please select a chat model.');
            return;
        }
        const promptList = prompts.split('\n').filter(p => p.trim());
        if (promptList.length === 0) {
            alert('Please enter at least one prompt.');
            return;
        }

        const model = models.find(m => m.id === modelId);

        const requests = promptList.map(prompt => ({
            prompt,
            model: modelId,
            type: model?.type,
            steps: model?.steps,
            stream: model?.type === 'chat' ? stream : undefined,
        }));
        
        if (requests.length === 0) {
            alert('Please enter at least one prompt in the booster section.');
            return;
        }

        setIsLoading(true);
        setStatus({ message: `Boosting ${requests.length} prompts...`, type: '' });
        setResponse({ type: 'boost_stream', results: Array(requests.length).fill(null), requests });

        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({ requests, stream: stream });
        const apiUrl = "/api/v1/booster/generate";

        try {
            if (stream && model?.type === 'chat') {
                 const response = await fetch(apiUrl, { method: 'POST', headers, body });
                 if (!response.ok) {
                    const errorJson = await response.json();
                    throw new Error(`Gateway Error (${response.status}): ${errorJson.error || JSON.stringify(errorJson)}`);
                 }
                 if (!response.body) {
                    throw new Error("Response body is null");
                 }
                 const reader = response.body.getReader();
                 const decoder = new TextDecoder();

                 let boosterResults = Array(requests.length).fill(null).map(() => ({ status: 'pending', content: '', keyId: '' }));

                 while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setStatus({ message: 'Boost complete!', type: 'success' });
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n\n');

                    for (const line of lines) {
                        if (line.trim().startsWith('data:')) {
                            const data = line.substring(5).trim();
                            if (data === '[DONE]') {
                                break;
                            }
                            try {
                                const json = JSON.parse(data);
                                const { index, status, content, reason, keyId } = json;
                                
                                if (boosterResults[index] === null) {
                                    boosterResults[index] = { status: 'pending', content: '', keyId: '' };
                                }
                                
                                if (boosterResults[index].status === 'pending') {
                                    boosterResults[index].status = status;
                                }

                                boosterResults[index].keyId = keyId;

                                if (status === 'streaming') {
                                    boosterResults[index].content += content;
                                } else if (status === 'fulfilled') {
                                     boosterResults[index].content = content;
                                } else if (status === 'rejected') {
                                    boosterResults[index].status = 'rejected';
                                    boosterResults[index].content = reason.message || 'Unknown error';
                                }

                                setResponse((prev: any) => ({
                                    ...prev,
                                    results: [...boosterResults]
                                }));


                            } catch(e) {
                                console.log('Skipping incomplete JSON chunk in booster:', data);
                            }
                        }
                    }
                 }
            } else {
                const res = await fetch(apiUrl, { method: 'POST', headers, body });
                const results = await res.json();
                if (!res.ok) {
                    throw new Error(`Gateway Error (${res.status}): ${results.error || 'Unknown booster error'}`);
                }
                
                if(results.error) {
                    throw new Error(`Gateway Error: ${results.error}`);
                }

                setStatus({ message: `Boost complete! Processed ${results.length} prompts.`, type: 'success' });
                setResponse({ type: 'boost', results, requests });
            }

        } catch (error: any) {
            console.error('Boost Fetch Error:', error);
            setResponse({ type: 'error', content: `An error occurred: ${error.message}` });
            setStatus({ message: 'Boost request failed.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

     if (chatModels.length === 0) {
        return null;
    }

    return (
        <div className="mb-8 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Booster</h2>
            <p className="text-sm text-muted-foreground mb-4">Bulk process chat prompts by entering one prompt per line.</p>
            <div className="grid gap-4">
                 <div>
                    <Label htmlFor="booster-model-select">Chat Model</Label>
                    <Select onValueChange={setModelId} defaultValue={modelId}>
                        <SelectTrigger id="booster-model-select">
                            <SelectValue placeholder="Select a chat model" />
                        </SelectTrigger>
                        <SelectContent>
                            {chatModels.map(model => (
                                <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="booster-prompts-textarea">Prompts (one per line)</Label>
                    <Textarea
                        id="booster-prompts-textarea"
                        placeholder="Write a poem about robots
Summarize the plot of Hamlet
Translate 'hello world' to French"
                        value={prompts}
                        onChange={(e) => setPrompts(e.target.value)}
                        rows={5}
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2 my-4">
                <Checkbox id="boosterStreamCheckbox" checked={stream} onCheckedChange={(checked) => setStream(Boolean(checked))} />
                <Label htmlFor="boosterStreamCheckbox">Stream Responses</Label>
            </div>
            <div className="flex gap-2 mt-2">
              <Button onClick={handleBoost} disabled={isLoading || !prompts.trim() || !modelId}>Boost Prompts</Button>
            </div>
        </div>
    )
}
