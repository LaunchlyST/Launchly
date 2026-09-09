import React, { useRef } from 'react';
import { useStore, GenerationResult } from '../../store';
import { ModelPicker } from '../../generator/ModelPicker';
import { StylePicker } from '../../generator/StylePicker';
import { PromptInput } from '../../generator/PromptInput';
import { ResultCard, ResultEmpty } from '../../generator/ResultCard';
import { Image as ImageIcon, Video } from 'lucide-react';
import * as openai from '../../services/openai';
import * as grok from '../../services/grok';
import '../../generator/generator.css';

export function GeneratorPage() {
  const openaiKey = useStore((s) => s.openaiKey);
  const grokKey = useStore((s) => s.grokKey);
  const selectedModel = useStore((s) => s.selectedModel);
  const selectedType = useStore((s) => s.selectedType);
  const selectedStyle = useStore((s) => s.selectedStyle);
  const prompt = useStore((s) => s.prompt);
  const isGenerating = useStore((s) => s.isGenerating);
  const result = useStore((s) => s.result);
  const error = useStore((s) => s.error);
  const videoStatus = useStore((s) => s.videoStatus);

  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const setSelectedStyle = useStore((s) => s.setSelectedStyle);
  const setPrompt = useStore((s) => s.setPrompt);
  const setIsGenerating = useStore((s) => s.setIsGenerating);
  const setResult = useStore((s) => s.setResult);
  const setError = useStore((s) => s.setError);
  const setVideoStatus = useStore((s) => s.setVideoStatus);

  const videoPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = prompt.trim().length > 0;
  const canGenerate =
    ready &&
    !isGenerating &&
    Boolean(
      (selectedModel === 'chatgpt' && openaiKey) || (selectedModel === 'grok' && grokKey)
    );

  const stopVideoPolling = () => {
    if (videoPollRef.current) {
      clearTimeout(videoPollRef.current);
      videoPollRef.current = null;
    }
  };

  const finish = (r: GenerationResult | null, e: string | null) => {
    setResult(r);
    setError(e);
    setIsGenerating(false);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    setIsGenerating(true);
    setVideoStatus(null);
    stopVideoPolling();

    const trimmedPrompt = prompt.trim();

    try {
      // ChatGPT generates images; Grok generates videos.
      if (selectedModel === 'chatgpt') {
        const url = await openai.generateImage(openaiKey, trimmedPrompt, selectedStyle);
        finish(
          { type: 'image', url, model: 'chatgpt', prompt: trimmedPrompt, timestamp: Date.now() },
          null
        );
      } else {
        const video = await grok.generateVideo(grokKey, trimmedPrompt, selectedStyle);
        const requestId = await video.startJob();
        setVideoStatus('processing');
        const poll = async () => {
          try {
            const res = await video.poll(requestId);
            if (res.status === 'done' && res.url) {
              finish(
                { type: 'video', url: res.url, model: 'grok', prompt: trimmedPrompt, timestamp: Date.now() },
                null
              );
              setVideoStatus('done');
            } else if (res.status === 'failed' || res.status === 'expired') {
              finish(null, res.error || 'Video generation failed');
              setVideoStatus('failed');
            } else {
              setVideoStatus(res.status);
              videoPollRef.current = setTimeout(poll, 5000);
            }
          } catch (err) {
            finish(null, err instanceof Error ? err.message : 'Polling error');
            setVideoStatus(null);
          }
        };
        poll();
      }
    } catch (err) {
      finish(null, err instanceof Error ? err.message : 'Something went wrong');
      setVideoStatus(null);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `tiktok-shop-${result.model}-${Date.now()}.${result.type === 'image' ? 'png' : 'mp4'}`;
    a.click();
  };

  const handleRegenerate = () => {
    setResult(null);
    handleGenerate();
  };

  const typeLabel = selectedModel === 'chatgpt' ? 'Image' : 'Video';

  return (
    <div className="gen-page">
      <header className="gen-header">
        <h1 className="gen-title">TikTok Shop Creator</h1>
        <p className="gen-subtitle">Create AI-powered images and videos for your TikTok Shop</p>
      </header>

      <div className="gen-card">
        <ModelPicker
          value={selectedModel}
          onChange={setSelectedModel}
          openaiReady={!!openaiKey}
          grokReady={!!grokKey}
        />

        <div className="picker-group">
          <label className="picker-label">Output</label>
          <div className="output-badge">
            {typeLabel === 'Image' ? <ImageIcon size={18} /> : <Video size={18} />}
            <span>{selectedModel === 'chatgpt' ? 'ChatGPT generates images' : 'Grok generates videos'}</span>
          </div>
        </div>

        {selectedType === 'image' && (
          <StylePicker value={selectedStyle} onChange={setSelectedStyle} />
        )}

        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onGenerate={handleGenerate}
          canGenerate={canGenerate}
          busy={isGenerating}
        />

        {videoStatus && videoStatus !== 'done' && (
          <p className="gen-status">
            {videoStatus === 'processing' ? 'Video is being generated…' : `Status: ${videoStatus}`}
          </p>
        )}

        {error && <div className="gen-error">{error}</div>}
      </div>

      <section className="gen-result-section">
        {result ? (
          <ResultCard
            result={result}
            busy={isGenerating}
            onDownload={handleDownload}
            onRegenerate={handleRegenerate}
          />
        ) : (
          <ResultEmpty />
        )}
      </section>
    </div>
  );
}
