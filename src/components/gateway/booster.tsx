"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
                return {
                    prompt: g.prompt,
                    model: g.modelId,
                    type: model?.type,
                    steps: model?.steps
                };
            });
        
        if (requests.length === 0) {
            alert('Please enter at least one prompt in the booster section.');
            return;
        }

        setIsLoading(true);
        setStatus({ message: `Boosting ${requests.length} prompts...`, type: '' });
        setResponse(null);

        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({ requests });
        const apiUrl = "/api/v1/booster/generate";

        try {
            const res = await fetch(apiUrl, { method: 'POST', headers, body });
            const results = await res.json();
            if (!res.ok) {
                throw new Error(`Gateway Error (${res.status}): ${results.error || 'Unknown booster error'}`);
            }

            setStatus({ message: `Boost complete! Processed ${results.length} prompts.`, type: 'success' });
            setResponse({ type: 'boost', results, requests });

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
            <div className="flex gap-2 mt-2">
              <Button onClick={addBoosterPromptGroup}>Add Prompt</Button>
              <Button onClick={handleBoost} disabled={isLoading}>Boost</Button>
            </div>
        </div>
    )
}
