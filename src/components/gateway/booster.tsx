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

interface BoosterPrompt {
    id: string;
    prompt: string;
    modelId: string;
}

const BoosterPromptGroup = ({ group, models, updateGroup, removeGroup }: { group: BoosterPrompt, models: Model[], updateGroup: (id: string, newGroup: Partial<BoosterPrompt>) => void, removeGroup: (id: string) => void }) => {
    return (
        <div className="booster-prompt-group">
            <Textarea
                placeholder="Enter prompt here..."
                value={group.prompt}
                onChange={(e) => updateGroup(group.id, { prompt: e.target.value })}
            />
            <Select onValueChange={(modelId) => updateGroup(group.id, { modelId })} defaultValue={group.modelId}>
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
            <Button onClick={() => removeGroup(group.id)} variant="destructive">Remove</Button>
        </div>
    );
};

export function Booster({ models, setStatus, setResponse, setIsLoading, isLoading }: BoosterProps) {
    const [promptGroups, setPromptGroups] = useState<BoosterPrompt[]>([
        { id: `group-${Date.now()}`, prompt: '', modelId: models[0].id }
    ]);
    const [stream, setStream] = useState(true);

    const addBoosterPromptGroup = () => {
        setPromptGroups(prev => [...prev, { id: `group-${Date.now()}`, prompt: '', modelId: models[0].id }]);
    };
    
    const updateBoosterPromptGroup = (id: string, newGroup: Partial<BoosterPrompt>) => {
        setPromptGroups(prev => prev.map(g => g.id === id ? { ...g, ...newGroup } : g));
    };

    const removeBoosterPromptGroup = (id: string) => {
        setPromptGroups(prev => prev.filter(g => g.id !== id));
    };

    const handleBoost = async () => {
        const requests = promptGroups
            .filter(g => g.prompt.trim())
            .map(g => {
                const model = models.find(m => m.id === g.modelId);
                const isChat = model?.type === 'chat';
                return {
                    prompt: g.prompt,
                    model: g.modelId,
                    type: model?.type,
                    steps: model?.steps,
                    stream: isChat ? stream : undefined, // Only add stream for chat models
                };
            });
        
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
            if (stream) {
                 const response = await fetch(apiUrl, { method: 'POST', headers, body });
                 if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Gateway Error (${response.status}): ${errorText}`);
                 }
                 if (!response.body) {
                    throw new Error("Response body is null");
                 }
                 const reader = response.body.getReader();
                 const decoder = new TextDecoder();

                 let boosterResults = Array(requests.length).fill(null).map(() => ({ status: 'pending', content: '' }));

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
                                const { index, type, status, content, reason } = json;
                                
                                if (boosterResults[index].status === 'pending') {
                                    boosterResults[index].status = status;
                                }

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

    return (
        <div className="mb-8 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Booster</h2>
            <div id="booster-prompts-container">
                {promptGroups.map(group => (
                    <BoosterPromptGroup 
                        key={group.id}
                        group={group}
                        models={models}
                        updateGroup={updateBoosterPromptGroup}
                        removeGroup={removeBoosterPromptGroup}
                    />
                ))}
            </div>
            <div className="flex items-center space-x-2 my-2">
                <Checkbox id="boosterStreamCheckbox" checked={stream} onCheckedChange={(checked) => setStream(Boolean(checked))} />
                <Label htmlFor="boosterStreamCheckbox">Stream Responses</Label>
            </div>
            <div className="flex gap-2 mt-2">
              <Button onClick={addBoosterPromptGroup}>Add Prompt</Button>
              <Button onClick={handleBoost} disabled={isLoading}>Boost</Button>
            </div>
        </div>
    )
}
