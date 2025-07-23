
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Model } from './models';
import { X, PlusCircle } from 'lucide-react';

interface BoosterProps {
    models: Model[];
    setStatus: (status: { message: string; type: string }) => void;
    setResponse: (response: any) => void;
    setIsLoading: (isLoading: boolean) => void;
    isLoading: boolean;
}

export function Booster({ models, setStatus, setResponse, setIsLoading, isLoading }: BoosterProps) {
    const chatModels = models.filter(m => m.type === 'chat');
    const [prompts, setPrompts] = useState<string[]>(['']);
    const [modelId, setModelId] = useState<string | undefined>(chatModels[0]?.id);
    const [stream, setStream] = useState(true);

    const handlePromptChange = (index: number, value: string) => {
        const newPrompts = [...prompts];
        newPrompts[index] = value;
        setPrompts(newPrompts);
    };

    const addPrompt = () => {
        setPrompts([...prompts, '']);
    };

    const removePrompt = (index: number) => {
        const newPrompts = prompts.filter((_, i) => i !== index);
        setPrompts(newPrompts);
    };

    const handleBoost = async () => {
        if (!modelId) {
            alert('Please select a chat model.');
            return;
        }
        const promptList = prompts.filter(p => p.trim());
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
                                        newResults[index].content = content;
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

     if (chatModels.length === 0) {
        return null;
    }

    return (
        <div className="mb-8 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Booster</h2>
            <p className="text-sm text-muted-foreground mb-4">Bulk process chat prompts.</p>
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
                    <Label>Prompts</Label>
                    <div className="space-y-2">
                        {prompts.map((prompt, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    type="text"
                                    placeholder={`Prompt ${index + 1}`}
                                    value={prompt}
                                    onChange={(e) => handlePromptChange(index, e.target.value)}
                                />
                                {prompts.length > 1 && (
                                    <Button variant="ghost" size="icon" onClick={() => removePrompt(index)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addPrompt} className="mt-2">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Prompt
                    </Button>
                </div>
            </div>

            <div className="flex items-center space-x-2 my-4">
                <Checkbox id="boosterStreamCheckbox" checked={stream} onCheckedChange={(checked) => setStream(Boolean(checked))} />
                <Label htmlFor="boosterStreamCheckbox">Stream Responses</Label>
            </div>
            <div className="flex gap-2 mt-2">
              <Button onClick={handleBoost} disabled={isLoading || prompts.every(p => !p.trim()) || !modelId}>Boost Prompts</Button>
            </div>
        </div>
    )
}
