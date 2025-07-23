
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Model } from './models';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';

interface BoosterProps {
    models: Model[];
    setStatus: (status: { message: string; type: string }) => void;
    setResponse: (response: any) => void;
    setIsLoading: (isLoading: boolean) => void;
    isLoading: boolean;
}

interface DynamicPrompt {
    id: number;
    prompt: string;
    modelId: string;
}

export function Booster({ models, setStatus, setResponse, setIsLoading, isLoading }: BoosterProps) {
    const [prompts, setPrompts] = useState('');
    const [modelId, setModelId] = useState<string | undefined>(models[0]?.id);
    const [stream, setStream] = useState(true);
    const [dynamicPrompts, setDynamicPrompts] = useState<DynamicPrompt[]>([]);

    const addDynamicPrompt = () => {
        setDynamicPrompts([...dynamicPrompts, { id: Date.now(), prompt: '', modelId: models[0]?.id || '' }]);
    };

    const removeDynamicPrompt = (id: number) => {
        setDynamicPrompts(dynamicPrompts.filter(p => p.id !== id));
    };

    const handleDynamicPromptChange = (id: number, field: 'prompt' | 'modelId', value: string) => {
        setDynamicPrompts(dynamicPrompts.map(p => p.id === id ? { ...p, [field]: value } : p));
    };


    const handleBoost = async () => {
        const textareaPrompts = prompts.split('\n').filter(p => p.trim());
        if (!modelId && textareaPrompts.length > 0) {
            alert('Please select a model for the text area prompts.');
            return;
        }

        const modelForTextarea = models.find(m => m.id === modelId);

        const requestsFromTextarea = textareaPrompts.map(prompt => ({
            prompt,
            model: modelId,
            type: modelForTextarea?.type,
            steps: modelForTextarea?.steps,
            stream: modelForTextarea?.type === 'chat' ? stream : undefined,
        }));
        
        const requestsFromDynamic = dynamicPrompts
          .filter(p => p.prompt.trim())
          .map(p => {
              const model = models.find(m => m.id === p.modelId);
              return {
                  prompt: p.prompt,
                  model: p.modelId,
                  type: model?.type,
                  steps: model?.steps,
                  stream: model?.type === 'chat' ? stream : undefined
              }
          });
        
        const requests = [...requestsFromTextarea, ...requestsFromDynamic];

        if (requests.length === 0) {
            alert('Please enter at least one prompt.');
            return;
        }

        setIsLoading(true);
        setStatus({ message: `Boosting ${requests.length} prompts...`, type: '' });
        setResponse({ type: 'boost_stream', results: Array(requests.length).fill(null), requests });

        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({ requests, stream: stream });
        const apiUrl = "/api/v1/booster/generate";

        try {
            if (stream) {
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

                 let buffer = '';

                 while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setStatus({ message: 'Boost complete!', type: 'success' });
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep the last, potentially incomplete line

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
                                    if (!prev || !prev.results) return prev;
                                    const newResults = [...prev.results];

                                    if (newResults[index] === null) {
                                        newResults[index] = { status: 'pending', content: '', keyId: '' };
                                    }

                                    if (keyId) {
                                      newResults[index].keyId = keyId;
                                    }

                                    switch(status) {
                                        case 'streaming':
                                            newResults[index].status = 'streaming';
                                            newResults[index].content += content;
                                            break;
                                        case 'fulfilled':
                                            newResults[index].status = 'fulfilled';
                                            if (json.type === 'chat' && content && content.choices) {
                                                newResults[index].content = content.choices[0].message.content;
                                            } else {
                                                newResults[index].content = content; 
                                            }
                                            break;
                                        case 'rejected':
                                            newResults[index].status = 'rejected';
                                            newResults[index].content = reason.message || 'Unknown error';
                                            break;
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
            <p className="text-sm text-muted-foreground mb-4">Send multiple chat prompts.</p>
            
            <div className="grid gap-4 p-4 border rounded-lg mb-4">
                 <div>
                    <Label htmlFor="booster-model-select">Chat Model for Text Area Prompts</Label>
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
                        rows={3}
                    />
                </div>
            </div>

            {dynamicPrompts.map((p, index) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-start p-4 border rounded-lg mb-4">
                    <div className="flex flex-col gap-2">
                         <Label htmlFor={`dp-model-${p.id}`}>Model</Label>
                         <Select onValueChange={(value) => handleDynamicPromptChange(p.id, 'modelId', value)} defaultValue={p.modelId}>
                            <SelectTrigger id={`dp-model-${p.id}`}>
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
                         <Label htmlFor={`dp-prompt-${p.id}`}>Prompt</Label>
                        <Textarea
                            id={`dp-prompt-${p.id}`}
                            placeholder="Enter prompt..."
                            value={p.prompt}
                            onChange={(e) => handleDynamicPromptChange(p.id, 'prompt', e.target.value)}
                            rows={2}
                        />
                    </div>
                     <Button variant="ghost" size="icon" onClick={() => removeDynamicPrompt(p.id)} className="self-center mt-6">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}

            <div className="flex items-center justify-between mt-4">
                 <Button variant="outline" onClick={addDynamicPrompt}>Add Prompt</Button>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="boosterStreamCheckbox" checked={stream} onCheckedChange={(checked) => setStream(Boolean(checked))} />
                    <Label htmlFor="boosterStreamCheckbox">Stream Responses</Label>
                 </div>
            </div>


            <div className="flex gap-2 mt-4">
              <Button onClick={handleBoost} disabled={isLoading || (!prompts.trim() && dynamicPrompts.every(p => !p.prompt.trim()))}>Boost Prompts</Button>
            </div>
        </div>
    )
}
