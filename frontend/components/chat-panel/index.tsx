'use client';

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import TableChartIcon from '@mui/icons-material/TableChart';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import { useBillContext } from '@/components/shared/bill-context';
import type { Bill } from '@/components/shared/types';
import { useLang } from '@/lib/i18n';

interface ChatPanelProps {
  onClose: () => void;
}

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  files?: File[];
};

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const { t } = useLang();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: t('chat.greeting') },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { uploadedBills, setUploadedBills } = useBillContext();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <ImageIcon sx={{ fontSize: 14 }} />;
    if (type === 'application/pdf') return <DescriptionIcon sx={{ fontSize: 14 }} />;
    if (type.includes('word') || type.includes('document')) return <ArticleIcon sx={{ fontSize: 14 }} />;
    if (type.includes('sheet') || type.includes('excel')) return <TableChartIcon sx={{ fontSize: 14 }} />;
    return <AttachFileIcon sx={{ fontSize: 14 }} />;
  };

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>, customMessage?: string) => {
    e.preventDefault();
    const messageContent = customMessage || input;
    if (!messageContent.trim() && selectedFiles.length === 0) return;

    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: messageContent,
      files: selectedFiles.length > 0 ? selectedFiles : undefined,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    const billFiles = selectedFiles.filter(
      f =>
        f.type.startsWith('image/') ||
        f.type === 'application/pdf' ||
        f.name.toLowerCase().includes('bill') ||
        f.name.toLowerCase().includes('meralco'),
    );

    setSelectedFiles([]);
    setIsLoading(true);

    setTimeout(() => {
      let responseContent = t('chat.responseGeneric');

      if (billFiles.length > 0) {
        const fileNames = billFiles.map(f => f.name).join(', ');

        billFiles.forEach((file, fileIdx) => {
          const newBill: Bill = {
            id: uploadedBills.length + fileIdx + 1,
            name: file.name.replace(/\.[^/.]+$/, '') || 'MERALCO Bill',
            status: 'completed',
            uploadDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            ocrConfidence: 88 + Math.random() * 10,
            extractedData: {
              accountDetails: {
                accountNumber: '123-456-7890',
                customerName: 'Juan Dela Cruz',
                serviceAddress: '123 Main Street, Manila, 1000',
                meterNumber: 'M-2026-001',
                confidence: 95,
              },
              billingPeriod: {
                startDate: 'Apr 15, 2026',
                endDate: 'May 14, 2026',
                daysInPeriod: 30,
                readingDate: 'May 14, 2026',
                confidence: 98,
              },
              consumption: {
                previousReading: 12641,
                currentReading: 12832,
                totalkWh: 191,
                unit: 'kWh',
                confidence: 97,
              },
              charges: [
                { description: 'Generation', amount: 1140.5, confidence: 94 },
                { description: 'Transmission', amount: 185.75, confidence: 92 },
                { description: 'Distribution', amount: 125.3, confidence: 91 },
                { description: 'System Loss', amount: 45.5, confidence: 89 },
                { description: 'Metering', amount: 15.0, confidence: 95 },
              ],
              totalAmount: 1482.05,
              dueDate: 'Jun 5, 2026',
              confidence: 96,
            },
          };
          setUploadedBills(prev => [...prev, newBill]);
        });

        responseContent = `Read your bill: ${fileNames}\n\nQuick summary:\n• Consumption: 191 kWh\n• Total due: ₱1,482.05\n• Due date: Jun 5, 2026\n\nFull details saved to the Bills tab.`;
      }

      const botMessage: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: responseContent,
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 800);
  };

  const suggestions = [
    { key: 'analyze', label: t('chat.suggestion.analyze') },
    { key: 'bill', label: t('chat.suggestion.bill') },
    { key: 'save', label: t('chat.suggestion.save') },
  ];

  return (
    <div className="flex h-full flex-col bg-surface text-ink">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h2 className="font-display text-lg text-ink">{t('chat.title')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-ink-3 hover:text-ink transition-colors p-1 -m-1"
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[85%]">
              <div
                className={
                  message.role === 'user'
                    ? 'px-3.5 py-2.5 rounded-lg rounded-br-sm bg-accent text-accent-ink'
                    : 'px-3.5 py-2.5 rounded-lg rounded-bl-sm bg-page text-ink border border-line'
                }
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>
              </div>
              {message.files && message.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-line bg-page text-xs text-ink-2"
                    >
                      <span className="text-ink-3">{getFileIcon(file)}</span>
                      <span className="truncate max-w-45">{file.name}</span>
                      <span className="text-ink-3 tabular">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-3 rounded-lg rounded-bl-sm bg-page border border-line">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" />
                <div
                  className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <div
                  className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="px-5 pb-3 space-y-2 border-t border-line pt-3">
          {suggestions.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={e =>
                handleSendMessage(e as unknown as FormEvent<HTMLFormElement>, s.label)
              }
              className="w-full text-left px-3 py-2.5 text-sm rounded-md border border-line text-ink-2 hover:border-line-strong hover:bg-elevated hover:text-ink transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="px-5 py-3 border-t border-line">
          <p className="text-xs text-ink-3 mb-2">
            {t('chat.attached')} ({selectedFiles.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-page text-xs text-ink-2"
              >
                <span className="text-ink-3">{getFileIcon(file)}</span>
                <span className="max-w-30 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-ink-3 hover:text-signal-strong transition-colors"
                  aria-label="Remove"
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="px-5 py-4 border-t border-line">
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-md border border-line-strong text-ink-2 hover:text-ink hover:bg-elevated transition-colors"
            title={t('chat.attachTitle')}
            aria-label={t('chat.attachTitle')}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="flex-1 px-3 py-2.5 rounded-md border border-line-strong bg-page text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
            className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-md bg-ink text-ink-inverse hover:bg-ink-2 disabled:bg-ink-3 disabled:cursor-not-allowed transition-colors"
            aria-label={t('common.send')}
          >
            <SendIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
        />
      </form>
    </div>
  );
}
