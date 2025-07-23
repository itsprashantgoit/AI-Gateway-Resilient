
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Model } from './models';
import { Checkbox } from '@/components/ui/checkbox';

interface BoosterProps {
    models: Model[];
    setStatus: (status: { message: string; type: string }) => void;
    setResponse: (response: any) => void;
    setIsLoading: (isLoading: boolean) => void;
    isLoading: boolean;
}

export function Booster({ models, setStatus, setResponse, setIsLoading, isLoading }: BoosterProps) {
    const [prompts, setPrompts] = useState('');
    const [modelId, setModelId] = useState<string | undefined>(models[0]?.id);
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
                                
                                setResponse((prev: any) => {
                                    const newResults = [...prev.results];
                                    if (newResults[index] === null) {
                                        newResults[index] = { status: 'pending', content: '', keyId: '' };
                                    }
                                    if(newResults[index].status === 'pending') {
                                       newResults[index].status = status;
                                    }
                                    newResults[index].keyId = keyId;

                                    if (status === 'streaming') {
                                        newResults[index].content += content;
                                    } else if (status === 'fulfilled') {
                                       if(typeof content === 'object' && content.choices) {
                                            newResults[index].content = content.choices[0].message.content;
                                        } else {
                                            newResults[index].content = content;
                                        }
                                    } else if (status === 'rejected') {
                                        newResults[index].status = 'rejected';
                                        newResults[index].content = reason.message || 'Unknown error';
                                    }
                                    return { ...prev, results: newResults };
                                });


                            } catch(e) {
                                console.log('Skipping incomplete JSON chunk in booster:', data);
                            }
                        }
                    }
                 }
            } else {
                const res = await fetch(apiUrl, { method: 'POST', headers, body });
                if (!res.ok) {
                    const errorJson = await res.json();
                    throw new Error(`Gateway Error (${res.status}): ${errorJson.error || 'Unknown booster error'}`);
                }
                const results = await res.json();
                
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

    if (models.length === 0) {
        return null;
    }

    return (
        <div className="mb-8 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Booster</h2>
            <p className="text-sm text-muted-foreground mb-4">Send multiple chat prompts (one per line).</p>
            <div className="grid gap-4">
                 <div>
                    <Label htmlFor="booster-model-select">Chat Model</Label>
                    <Select onValueChange={setModelId} defaultValue={modelId}>
                        <SelectTrigger id="booster-model-select">
                            <SelectValue placeholder="Select a chat model" />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map(model => (
                                <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Prompts (one per line)</Label>
                    <Textarea
                        placeholder="Enter prompts here, one on each line..."
                        value={prompts}
                        onChange={(e) => setPrompts(e.target.value)}
                        className="my-2"
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
