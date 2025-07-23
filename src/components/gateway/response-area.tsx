
"use client";

import Image from 'next/image';
import { Card } from '@/components/ui/card';

interface ResponseAreaProps {
    response: any;
}

export function ResponseArea({ response }: ResponseAreaProps) {
    if (!response) return <div id="response-area" className="mt-4 p-4 border rounded-lg min-h-[100px]"></div>;

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
        let keyId;

        if (result.status === 'fulfilled') {
            const value = result.value;
            keyId = value.keyId;

            if (request.type === 'chat') {
                content = <p>{value.choices[0].message.content}</p>
            } else { // image
                const b64_json = value?.data?.[0]?.b64_json;
                if (b64_json) {
                    content = <Image src={`data:image/png;base64,${b64_json}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md mt-2" />
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
                {content}
                {renderKey(keyId)}
            </>
        )
    };

    const renderStreamedBoostResult = (result: any, request: any) => {
        if (!result || result.status === 'pending') {
            return <p className="text-gray-500">Waiting for response...</p>;
        }
        if (result.status === 'rejected') {
            return (
                <>
                    <p className="text-red-500">Error: {result.content || 'An unknown error occurred.'}</p>
                    {renderKey(result.keyId)}
                </>
            )
        }

        let content;
        let keyId = result.keyId;

        if (request.type === 'chat') {
             const chatContent = (result.status === 'fulfilled' && result.content?.choices)
                ? result.content.choices[0].message.content
                : result.content;
            content = <p className="whitespace-pre-wrap">{chatContent}</p>
        }
        else if (request.type === 'image' && result.status === 'fulfilled') {
            const imageContent = result.content?.data?.[0]?.b64_json;
            
            if (result.content?.keyId) {
                keyId = result.content.keyId;
            }

            if (imageContent) {
                 content = <Image src={`data:image/png;base64,${imageContent}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md" />
            } else {
                 content = <p className="text-red-500">Error: Could not parse image.</p>;
            }
        } else if (result.status === 'streaming') {
            content = <p className="whitespace-pre-wrap">{result.content}</p>;
        } else {
            content = <p className="text-gray-500">Processing...</p>
        }

        return (
            <>
                <div className="flex-grow flex items-center justify-center">{content}</div>
                {renderKey(keyId)}
            </>
        )
    }


    const renderResponse = () => {
        switch (response.type) {
            case 'chat':
                return (
                    <>
                        <p>{response.content}</p>
                        {renderKey(response.keyId)}
                    </>
                );
            case 'image':
                 return (
                    <>
                        <Image src={`data:image/png;base64,${response.content}`} alt={response.alt} width={512} height={512} />
                        {renderKey(response.keyId)}
                    </>
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
                                    <div className="flex-grow flex flex-col justify-center items-center text-center">{renderBoostResult(result, request)}</div>
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
                                    <div className="flex-grow flex flex-col justify-center items-center text-center h-full">{renderStreamedBoostResult(result, request)}</div>
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
