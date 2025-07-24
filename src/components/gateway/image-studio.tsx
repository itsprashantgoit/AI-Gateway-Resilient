
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
            stream: true, 
        }));

        setIsLoading(true);
        setStatus({ message: `Generating ${requests.length} images...`, type: '' });
        
        setResponse({ type: 'boost_stream', results: Array(requests.length).fill(null), requests });

        const headers = { 'Content-Type': 'application/json' };
        const body = JSON.stringify({ requests, stream: true });
        const apiUrl = "/api/v1/booster/generate";

        try {
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
            
            let receivedCount = 0;
            const processStream = async () => {
              while (true) {
                 const { done, value } = await reader.read();
                 if (done) {
                     break;
                 }

                 buffer += decoder.decode(value, { stream: true });
                 const lines = buffer.split('\n\n');
                 buffer = lines.pop() || ''; // Keep the last, potentially incomplete line

                 for (const line of lines) {
                     if (line.trim().startsWith('data:')) {
                         const data = line.substring(5).trim();
                         if (data === '[DONE]') {
                             continue;
                         }
                         try {
                             const json = JSON.parse(data);
                             const { index, status, content, reason, keyId, rateLimitInfo } = json;
                             
                             if (index !== undefined && index < requests.length) {
                                setResponse((prev: any) => {
                                  if (!prev || !prev.results) return prev;
                                  const newResults = [...prev.results];
                                  newResults[index] = {
                                      status: status,
                                      content: status === 'fulfilled' ? content : (reason?.message || 'Unknown error'),
                                      keyId: keyId,
                                      rateLimitInfo: rateLimitInfo,
                                  };
                                  return { ...prev, results: newResults };
                                });
    
                                if (status === 'fulfilled' || status === 'rejected') {
                                     receivedCount++;
                                }
                             }

                         } catch(e) {
                             console.log('Skipping incomplete JSON chunk in image studio:', data);
                         }
                     }
                 }
              }
               if (receivedCount === requests.length) {
                  setStatus({ message: 'Image generation complete!', type: 'success' });
              }
            };

            await processStream();
        
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
            <p className="text-sm text-muted-foreground mb-4">Bulk generate images (one per line).</p>
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
            <div className="flex gap-2 mt-4">
              <Button onClick={handleGenerate} disabled={isLoading || !prompts.trim() || !modelId}>Generate Images</Button>
            </div>
        </div>
    )
}
