import React, {useState, useRef, useEffect} from 'react';
import './suggestions.css';

export function Suggestions({prefix, suggestions, selected, onPick}: {prefix: string, selected: string, suggestions: string[], onPick: (suggestion: string) => void}) {
    const ref = useRef<HTMLDivElement>();
    return <div className="suggestions">
        {suggestions.map((suggestion,index) => {
            const isSelected = selected === suggestion;
            return <Suggestion
                onPick={() => onPick(suggestion)}
                key={suggestion}
                suggestion={suggestion}
                prefix={prefix}
                isSelected={isSelected}
            />;
        })}
    </div>;
}

function Suggestion({prefix, suggestion, isSelected, onPick} : {prefix: string, suggestion: string, isSelected: boolean, onPick: () => void}) {
    const ref = useRef<HTMLDivElement>();
    useEffect(() => {
        if (isSelected) {
            ref.current.scrollIntoView({block: 'nearest'});
        }
    }, [isSelected]);
    return <div ref={ref} onClick={onPick} className={`suggestion ${isSelected ? 'selected' : ''}`}>
        {suggestion}
    </div>
}
