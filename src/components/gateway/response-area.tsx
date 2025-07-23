
"use client";

import Image from 'next/image';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';

interface ResponseAreaProps {
    response: any;
}

export function ResponseArea({ response }: ResponseAreaProps) {
    const [copiedText, setCopiedText] = useState<string | null>(null);

    if (!response) return <div id="response-area" className="mt-4 p-4 border rounded-lg min-h-[100px]"></div>;

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);
            setTimeout(() => setCopiedText(null), 2000); // Reset after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleDownload = (base64Data: string, filename = 'generated_image.png') => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${base64Data}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderKey = (keyId: string) => {
        if (!keyId) return null;
        return (
            <div className="text-xs text-gray-500 font-mono mt-2 pt-2 border-t">
                Key ID: {keyId}
            </div>
        )
    }

    const renderBoostResult = (result: any, request: any) => {
         if (!result) {
            return <p className="text-gray-500">Waiting for response...</p>;
        }
        
        let content;
        let actions;
        let keyId;

        if (result.status === 'fulfilled') {
            const value = result.value;
            keyId = value.keyId;

            if (request.type === 'chat') {
                const chatContent = value.choices[0].message.content;
                content = <p className="text-left whitespace-pre-wrap">{chatContent}</p>
                actions = (
                     <Button variant="ghost" size="sm" onClick={() => handleCopy(chatContent)}>
                        <Copy className="h-4 w-4 mr-1" />
                        {copiedText === chatContent ? 'Copied!' : 'Copy'}
                    </Button>
                )
            } else { // image
                const b64_json = value?.data?.[0]?.b64_json;
                if (b64_json) {
                    content = <Image src={`data:image/png;base64,${b64_json}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md mt-2" />
                    actions = (
                         <Button variant="ghost" size="sm" onClick={() => handleDownload(b64_json, `image_${value.keyId}.png`)}>
                            <Download className="h-4 w-4 mr-1" />
                            Download
                        </Button>
                    );
                } else {
                    content = <p className="text-red-500">Error: Image data not found.</p>
                }
            }
        } else if (result.status === 'rejected') {
            keyId = result.reason?.keyId;
            content = (
                <p className="text-red-500">
                    Failed to process prompt: {result.reason?.message || JSON.stringify(result.reason)}
                </p>
            );
        } else {
             content = <p className="text-gray-500">Processing...</p>;
        }

        return (
            <>
                <div className="flex-grow flex flex-col justify-center items-center text-center">{content}</div>
                <div className="flex-shrink-0 mt-2 flex flex-col items-center">
                    {actions}
                    {renderKey(keyId)}
                </div>
            </>
        )
    };

    const renderStreamedBoostResult = (result: any, request: any) => {
        if (!result || result.status === 'pending') {
            return <div className="flex-grow flex items-center justify-center"><p className="text-gray-500">Waiting for response...</p></div>;
        }

        let content;
        let actions;
        let keyId = result.keyId;

        if (result.status === 'rejected') {
            content = <p className="text-red-500">Error: {result.content || 'An unknown error occurred.'}</p>;
        } else if (request.type === 'chat') {
            const chatContent = result.content;
            content = <p className="text-left whitespace-pre-wrap">{chatContent}</p>;
            if (result.status !== 'streaming') {
                 actions = (
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(chatContent)}>
                        <Copy className="h-4 w-4 mr-1" />
                        {copiedText === chatContent ? 'Copied!' : 'Copy'}
                    </Button>
                );
            }
        } else if (request.type === 'image' && result.status === 'fulfilled') {
            const imageContent = result.content?.data?.[0]?.b64_json;
            
            if (result.content?.keyId) {
                keyId = result.content.keyId;
            }

            if (imageContent) {
                 content = <Image src={`data:image/png;base64,${imageContent}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md" />
                 actions = (
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(imageContent, `image_${keyId}.png`)}>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                    </Button>
                );
            } else {
                 content = <p className="text-red-500">Error: Could not parse image.</p>;
            }
        } else if (result.status === 'streaming') {
            content = <p className="text-left whitespace-pre-wrap">{result.content}</p>;
        } else {
            content = <p className="text-gray-500">Processing...</p>
        }

        return (
            <>
                <div className="flex-grow flex items-center justify-center">{content}</div>
                 <div className="flex-shrink-0 mt-2 flex flex-col items-center">
                    {actions}
                    {renderKey(keyId)}
                </div>
            </>
        )
    }


    const renderResponse = () => {
        switch (response.type) {
            case 'chat':
                return (
                    <div className="flex flex-col items-start gap-2">
                        <p className="whitespace-pre-wrap">{response.content}</p>
                         <div className="w-full flex flex-col items-start mt-2">
                             <Button variant="outline" size="sm" onClick={() => handleCopy(response.content)}>
                                <Copy className="h-4 w-4 mr-1" />
                                {copiedText === response.content ? 'Copied!' : 'Copy'}
                            </Button>
                            {renderKey(response.keyId)}
                        </div>
                    </div>
                );
            case 'image':
                 return (
                    <div className="flex flex-col items-center gap-2">
                        <Image src={`data:image/png;base64,${response.content}`} alt={response.alt} width={512} height={512} />
                        <div className="w-full flex flex-col items-start mt-2">
                            <Button variant="outline" size="sm" onClick={() => handleDownload(response.content, `image_${response.keyId}.png`)}>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                            </Button>
                            {renderKey(response.keyId)}
                        </div>
                    </div>
                );
            case 'error':
                return <p className="text-red-500">{response.content}</p>
            case 'boost':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {response.results.map((result: any, index: number) => {
                             const request = response.requests[index];
                             return (
                                <Card key={index} className="p-4 flex flex-col">
                                    <p className="font-semibold text-sm text-foreground border-b pb-2 mb-2 font-sans truncate" title={request.prompt}>
                                        {request.prompt}
                                    </p>
                                    {renderBoostResult(result, request)}
                                </Card>
                             )
                        })}
                    </div>
                );
             case 'boost_stream':
                return (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {response.results.map((result: any, index: number) => {
                             const request = response.requests[index];
                             return (
                                <Card key={index} className="p-4 flex flex-col">
                                    <p className="font-semibold text-sm text-foreground border-b pb-2 mb-2 font-sans truncate" title={request.prompt}>
                                        {request.prompt}
                                    </p>
                                    {renderStreamedBoostResult(result, request)}
                                </Card>
                             )
                        })}
                    </div>
                )

            default:
                return null;
        }
    }

    return (
        <div id="response-area" className="mt-4 p-4 border rounded-lg min-h-[100px] bg-gray-50">
           {renderResponse()}
        </div>
    )
}
