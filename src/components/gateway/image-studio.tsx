
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Model } from './models';

interface ImageStudioProps {
    models: Model[];
    setStatus: (status: { message: string; type: string }) => void;
    setResponse: (response: any) => void;
    setIsLoading: (isLoading: boolean) => void;
    isLoading: boolean;
}

export function ImageStudio({ models, setStatus, setResponse, setIsLoading, isLoading }: ImageStudioProps) {
    const [prompts, setPrompts] = useState('');
    const [modelId, setModelId] = useState<string | undefined>(models[0]?.id);

    const handleGenerate = async () => {
        if (!modelId) {
            alert('Please select an image model.');
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
            type: 'image',
            steps: model?.steps,
            stream: false, 
        }));

        setIsLoading(true);
        setStatus({ message: `Generating ${requests.length} images...`, type: '' });
        setResponse({ type: 'boost', results: Array(requests.length).fill(null), requests });

        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({ requests, stream: false });
        const apiUrl = "/api/v1/booster/generate";

        try {
            const res = await fetch(apiUrl, { method: 'POST', headers, body });
            const results = await res.json();
            
            if (!res.ok) {
                 const errorMessage = results.error || `An unknown error occurred. Status: ${res.status}`;
                 throw new Error(`Gateway Error: ${errorMessage}`);
            }

            setStatus({ message: `Generated ${results.length} images.`, type: 'success' });
            setResponse({ type: 'boost', results, requests });

        } catch (error: any) {
            console.error('Image Studio Fetch Error:', error);
            setResponse({ type: 'error', content: `An error occurred: ${error.message}` });
            setStatus({ message: 'Image generation failed.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    if (models.length === 0) {
        return null;
    }

    return (
        <div className="mb-8 p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Image Studio</h2>
            <p className="text-sm text-muted-foreground mb-4">Bulk generate images by entering one prompt per line.</p>
            <div className="grid gap-4">
                <div>
                    <Label htmlFor="image-model-select">Image Model</Label>
                    <Select onValueChange={setModelId} defaultValue={modelId}>
                        <SelectTrigger id="image-model-select">
                            <SelectValue placeholder="Select an image model" />
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
                    <Label htmlFor="image-prompts-textarea">Prompts (one per line)</Label>
                    <Textarea
                        id="image-prompts-textarea"
                        placeholder="A photorealistic cat astronaut on the moon
A synthwave sunset over a futuristic city
A detailed watercolor of a forest stream"
                        value={prompts}
                        onChange={(e) => setPrompts(e.target.value)}
                        rows={5}
                    />
                </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleGenerate} disabled={isLoading || !prompts.trim() || !modelId}>Generate Images</Button>
            </div>
        </div>
    )
}
