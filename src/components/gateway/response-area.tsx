
"use client";

import Image from 'next/image';

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
        if (result.status === 'fulfilled') {
            const content = request.type === 'chat' ? (
                <p>{result.value.choices[0].message.content}</p>
            ) : (
                result.value.data && result.value.data[0] && result.value.data[0].b64_json ? (
                    <Image src={`data:image/png;base64,${result.value.data[0].b64_json}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md mt-2" />
                ) : <p className="text-red-500">Error: Image data not found.</p>
            );
            return (
                <>
                    {content}
                    {renderKey(result.value.keyId)}
                </>
            )
        }
        return (
            <>
                <p className="text-red-500">
                    Failed to process prompt: {result.reason?.message || JSON.stringify(result.reason)}
                </p>
                {renderKey(result.keyId)}
            </>
        )
    };

    const renderStreamedBoostResult = (result: any, request: any) => {
        if (!result) {
            return <p className="text-gray-500">Waiting for response...</p>;
        }
        if (result.status === 'rejected') {
            return (
                <>
                    <p className="text-red-500">Error: {result.content}</p>
                    {renderKey(result.keyId)}
                </>
            )
        }
        let content;
        if (request.type === 'chat') {
            const chatContent = (typeof result.content === 'object' && result.content !== null && result.content.choices)
                ? result.content.choices[0].message.content
                : result.content;
            content = <p>{chatContent}</p>
        }
        else if (request.type === 'image') {
            const imageContent = result.content?.data?.[0]?.b64_json;
            content = imageContent ? (
                 <Image src={`data:image/png;base64,${imageContent}`} alt={request.prompt} width={256} height={256} className="max-w-full rounded-md mt-2" />
            ) : <p className="text-gray-500">Processing image...</p>
        } else {
            content = null;
        }

        return (
            <>
                {content}
                {renderKey(result.keyId)}
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
                    <div>
                        {response.results.map((result: any, index: number) => {
                             const request = response.requests[index];
                             return (
                                <div key={index} className="mb-4 p-4 border rounded-lg shadow-md">
                                    <p className="font-bold text-green-600 border-b pb-2 mb-2 font-mono">
                                        Prompt: "{request.prompt}" (Model: {request.model})
                                    </p>
                                    <div>{renderBoostResult(result, request)}</div>
                                </div>
                             )
                        })}
                    </div>
                );
             case 'boost_stream':
                return (
                     <div>
                        {response.results.map((result: any, index: number) => {
                             const request = response.requests[index];
                             return (
                                <div key={index} className="mb-4 p-4 border rounded-lg shadow-md">
                                    <p className="font-bold text-green-600 border-b pb-2 mb-2 font-mono">
                                        Prompt: "{request.prompt}" (Model: {request.model})
                                    </p>
                                    <div>{renderStreamedBoostResult(result, request)}</div>
                                </div>
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
