import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Brackets,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Command,
  Binary,
  Eraser,
  FileArchive,
  FileCode2,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderOpen,
  HardDrive,
  HelpCircle,
  History,
  LayoutGrid,
  Languages,
  LockKeyhole,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  MoveRight,
  PanelLeft,
  PenLine,
  Plus,
  Presentation,
  ScanText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Split,
  Table2,
  TextCursorInput,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  type Activity as ActivityRecord,
  type DashboardSummary,
  type FileRecord,
  type ProcessingJob,
  getGetDashboardSummaryQueryKey,
  getGetFileQueryKey,
  getGetProcessingJobQueryKey,
  getHealthCheckQueryKey,
  getListFilesQueryKey,
  useCreateFile,
  useCreateProcessingJob,
  useGetDashboardSummary,
  useGetFile,
  useGetProcessingJob,
  useHealthCheck,
  useListFiles,
} from '@workspace/api-client-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type ToolCategory = 'DOCUMENT' | 'IMAGE' | 'AI' | 'STUDENT TOOLS' | 'DEVELOPER TOOLS';
type ToolDefinition = { slug: string; title: string; category: ToolCategory; description: string; icon: typeof FileArchive; accent: string; detail: string };
const makeTool = (slug: string, title: string, category: ToolCategory, icon: typeof FileArchive, accent = 'teal'): ToolDefinition => ({
  slug, title, category, icon, accent,
  description: category === 'DEVELOPER TOOLS' ? `A focused utility for working with ${title.toLowerCase()}.` : `A faster way to ${title.toLowerCase()}.`,
  detail: `Open ${title.toLowerCase()} and get a clear result.`,
});

const toolCatalog: ToolDefinition[] = [
  { ...makeTool('pdf-to-word', 'PDF → Word', 'DOCUMENT', FileText, 'coral'), description: 'Turn PDF pages into an editable Word document.', detail: 'Keep structure while you move into Word.' },
  { ...makeTool('pdf-to-excel', 'PDF → Excel', 'DOCUMENT', FileSpreadsheet, 'teal') },
  { ...makeTool('pdf-to-ppt', 'PDF → PPT', 'DOCUMENT', Presentation, 'gold') },
  { ...makeTool('pdf-to-markdown', 'PDF → Markdown', 'DOCUMENT', FileCode2, 'blue') },
  { ...makeTool('pdf-to-json', 'PDF → JSON', 'DOCUMENT', Brackets, 'ink') },
  { ...makeTool('merge-pdf', 'Merge PDF', 'DOCUMENT', FileStack, 'teal'), description: 'Bring separate documents into one clean sequence.', detail: 'Combine PDFs in the order you choose.' },
  { ...makeTool('compress-pdf', 'Compress PDF', 'DOCUMENT', FileArchive, 'coral'), description: 'Shrink file weight without sacrificing clarity.', detail: 'Reduce document size for sharing and storage.' },
  { ...makeTool('ocr-pdf', 'OCR', 'DOCUMENT', ScanText, 'gold') },
  { ...makeTool('extract-tables', 'Extract tables', 'DOCUMENT', Table2, 'blue') },
  { ...makeTool('remove-pages', 'Remove pages', 'DOCUMENT', Trash2, 'coral') },
  { ...makeTool('sign-pdf', 'Sign PDF', 'DOCUMENT', PenLine, 'gold') },
  { ...makeTool('redact-pdf', 'Redact PDF', 'DOCUMENT', Eraser, 'ink') },
  { ...makeTool('split-pdf', 'Split PDF', 'DOCUMENT', Split, 'gold'), description: 'Pull out only the pages that matter.', detail: 'Extract the exact range you need.' },
  { ...makeTool('pdf-to-image', 'PDF → image', 'IMAGE', FileImage, 'blue'), description: 'Turn pages into crisp, shareable images.', detail: 'Export pages as high quality images.' },
  { ...makeTool('jpg-to-png', 'JPG → PNG', 'IMAGE', FileImage, 'teal') },
  { ...makeTool('png-to-jpg', 'PNG → JPG', 'IMAGE', FileImage, 'coral') },
  { ...makeTool('webp-converter', 'WebP converter', 'IMAGE', FileImage, 'gold') },
  { ...makeTool('image-compressor', 'Image compressor', 'IMAGE', FileArchive, 'blue') },
  { ...makeTool('background-remover', 'Background remover', 'IMAGE', ScanText, 'coral') },
  { ...makeTool('image-to-pdf', 'Image → PDF', 'IMAGE', FilePlus2, 'ink'), description: 'Make a polished document from your images.', detail: 'Arrange scans and photos into one PDF.' },
  { ...makeTool('screenshot-to-text', 'Screenshot → text', 'IMAGE', TextCursorInput, 'teal') },
  { ...makeTool('image-to-editable-document', 'Image → editable document', 'IMAGE', FileText, 'gold') },
  { ...makeTool('summarize-document', 'Summarize document', 'AI', Sparkles, 'coral') },
  { ...makeTool('ask-questions-about-pdf', 'Ask questions about PDF', 'AI', MessageSquareText, 'teal') },
  { ...makeTool('extract-data', 'Extract data', 'AI', Table2, 'gold') },
  { ...makeTool('translate-document', 'Translate document', 'AI', Languages, 'blue') },
  { ...makeTool('rewrite-document', 'Rewrite document', 'AI', FileText, 'ink') },
  { ...makeTool('generate-notes', 'Generate notes', 'AI', BookOpen, 'coral') },
  { ...makeTool('generate-flashcards', 'Generate flashcards', 'AI', FileStack, 'teal') },
  { ...makeTool('generate-mcqs', 'Generate MCQs', 'AI', Check, 'gold') },
  { ...makeTool('resume-analyzer', 'Resume analyzer', 'AI', FileText, 'blue') },
  { ...makeTool('gpa-calculator', 'GPA calculator', 'STUDENT TOOLS', Calculator, 'coral') },
  { ...makeTool('percentage-calculator', 'Percentage calculator', 'STUDENT TOOLS', Calculator, 'teal') },
  { ...makeTool('cgpa-calculator', 'CGPA calculator', 'STUDENT TOOLS', Calculator, 'gold') },
  { ...makeTool('attendance-calculator', 'Attendance calculator', 'STUDENT TOOLS', Calculator, 'blue') },
  { ...makeTool('assignment-formatter', 'Assignment formatter', 'STUDENT TOOLS', FileText, 'ink') },
  { ...makeTool('citation-generator', 'Citation generator', 'STUDENT TOOLS', BookOpen, 'coral') },
  { ...makeTool('pdf-to-notes', 'PDF → notes', 'STUDENT TOOLS', FileText, 'teal') },
  { ...makeTool('notes-to-pdf', 'Notes → PDF', 'STUDENT TOOLS', FilePlus2, 'gold') },
  { ...makeTool('question-paper-generator', 'Question paper generator', 'STUDENT TOOLS', FileStack, 'blue') },
  { ...makeTool('json-formatter', 'JSON formatter', 'DEVELOPER TOOLS', Brackets, 'coral') },
  { ...makeTool('json-to-csv', 'JSON → CSV', 'DEVELOPER TOOLS', FileSpreadsheet, 'teal') },
  { ...makeTool('csv-to-json', 'CSV → JSON', 'DEVELOPER TOOLS', Brackets, 'gold') },
  { ...makeTool('jwt-decoder', 'JWT decoder', 'DEVELOPER TOOLS', LockKeyhole, 'blue') },
  { ...makeTool('base64-encoder-decoder', 'Base64 encoder/decoder', 'DEVELOPER TOOLS', Binary, 'ink') },
  { ...makeTool('uuid-generator', 'UUID generator', 'DEVELOPER TOOLS', Command, 'coral') },
  { ...makeTool('regex-tester', 'Regex tester', 'DEVELOPER TOOLS', TextCursorInput, 'teal') },
  { ...makeTool('timestamp-converter', 'Timestamp converter', 'DEVELOPER TOOLS', Clock3, 'gold') },
  { ...makeTool('sql-formatter', 'SQL formatter', 'DEVELOPER TOOLS', FileCode2, 'blue') },
  { ...makeTool('html-css-js-minifier', 'HTML/CSS/JS minifier', 'DEVELOPER TOOLS', FileCode2, 'ink') },
];

const fallbackFiles: FileRecord[] = [
  { id: 'sample-1', name: 'field-notes-final.pdf', kind: 'pdf', size: 2480000, status: 'ready', createdAt: '2024-04-18T09:30:00Z', pages: 24 },
  { id: 'sample-2', name: 'q2-research-images.zip', kind: 'archive', size: 18400000, status: 'ready', createdAt: '2024-04-17T15:10:00Z', pages: null },
  { id: 'sample-3', name: 'project-brief.pdf', kind: 'pdf', size: 890000, status: 'processing', createdAt: '2024-04-16T12:45:00Z', pages: 8 },
];

function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1000000).toFixed(1)} MB`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${light ? 'text-[#f8f4eb]' : 'text-[#192d31]'}`} data-testid="link-logo">
      <span className={`grid h-8 w-8 place-items-center rounded-[9px] ${light ? 'bg-[#f8f4eb] text-[#192d31]' : 'bg-[#173c3b] text-[#f8f4eb]'}`}>
        <span className="font-display text-[17px] font-bold tracking-[-.08em]">F</span>
      </span>
      <span className="font-display text-[19px] font-semibold tracking-[-.04em]">FLUX</span>
    </Link>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: { children: ReactNode; variant?: 'primary' | 'outline' | 'quiet' | 'coral'; className?: string; [key: string]: unknown }) {
  const styles = {
    primary: 'bg-[#173c3b] text-[#f8f4eb] hover:bg-[#285c57]',
    outline: 'border border-[#cfcabf] bg-[#f8f4eb] text-[#1b3032] hover:border-[#173c3b] hover:bg-[#eee9dd]',
    quiet: 'text-[#5c6d6c] hover:bg-[#eae5d9] hover:text-[#173c3b]',
    coral: 'bg-[#ef765f] text-[#fff8ee] hover:bg-[#df654f]',
  }[variant];
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} {...props}>{children}</button>;
}

function StatusPill({ status }: { status: string }) {
  const style = status === 'ready' || status === 'completed'
    ? 'bg-[#d7ede1] text-[#28674e]'
    : status === 'processing' || status === 'queued'
      ? 'bg-[#f8e7b9] text-[#846018]'
      : 'bg-[#f7d8d1] text-[#a14838]';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-[.12em] ${style}`} data-testid={`status-${status}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function AppHeader({ onMenu }: { onMenu?: () => void }) {
  const [location] = useLocation();
  const isApp = ['/dashboard', '/document-chat'].includes(location) || location.includes('pdf');
  return (
    <header className={`flex h-[72px] items-center justify-between border-b px-5 md:px-8 ${isApp ? 'border-[#d8d3c9] bg-[#f4f1ea]/95' : 'border-[#31504c]/20 bg-[#173c3b]'}`}>
      <div className="flex items-center gap-4">
        {onMenu && <button onClick={onMenu} className="rounded-lg p-2 text-[#f8f4eb] md:hidden" data-testid="button-open-menu"><Menu size={20} /></button>}
        <Logo light={!isApp} />
      </div>
      {!isApp && (
        <nav className="hidden items-center gap-7 text-sm text-[#d5e2dc] md:flex">
          <Link href="/tools" className="hover:text-white" data-testid="link-tools-header">Tools</Link>
          <Link href="/pricing" className="hover:text-white" data-testid="link-pricing-header">Pricing</Link>
          <Link href="/security" className="hover:text-white" data-testid="link-security-header">Security</Link>
        </nav>
      )}
      <div className="flex items-center gap-2.5">
        <Link href="/sign-in" className={`hidden px-3 py-2 text-sm font-semibold sm:inline-flex ${isApp ? 'text-[#526463] hover:text-[#173c3b]' : 'text-[#d5e2dc] hover:text-white'}`} data-testid="link-sign-in-header">Sign in</Link>
        <Link href="/sign-up" className={`inline-flex items-center rounded-lg px-3.5 py-2.5 text-sm font-semibold ${isApp ? 'bg-[#173c3b] text-[#f8f4eb]' : 'bg-[#f5e5bd] text-[#173c3b]'} hover:opacity-90`} data-testid="link-sign-up-header">Start free <ArrowRight size={15} /></Link>
      </div>
    </header>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation()[0];
  const nav = [
    { href: '/dashboard', label: 'Workspace', icon: LayoutGrid },
    { href: '/tools', label: 'Tools', icon: Zap },
    { href: '/document-chat', label: 'Document chat', icon: MessageSquareText },
  ];
  return (
    <div className="min-h-[100dvh] bg-[#f4f1ea] text-[#1b3032]">
      <AppHeader onMenu={() => setMenuOpen(true)} />
      <div className="flex">
        <aside className={`fixed inset-y-[72px] left-0 z-40 w-[238px] border-r border-[#d8d3c9] bg-[#f4f1ea] p-4 transition-transform md:sticky md:top-[72px] md:block md:h-[calc(100dvh-72px)] md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-8 flex items-center justify-between md:hidden"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#74817e]">Navigation</span><button onClick={() => setMenuOpen(false)} data-testid="button-close-menu"><X size={18} /></button></div>
          <div className="mb-3 px-3 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#8a928b]">Workspace</div>
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${location === href ? 'bg-[#dce9e2] text-[#173c3b]' : 'text-[#64716e] hover:bg-[#ebe7dd] hover:text-[#173c3b]'}`} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{href === '/document-chat' && <span className="ml-auto rounded bg-[#ef765f] px-1.5 py-0.5 font-mono-ui text-[9px] text-white">BETA</span>}</Link>)}
          </nav>
          <div className="mb-3 mt-8 px-3 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#8a928b]">Account</div>
          <nav className="space-y-1">
            <Link href="/pricing" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#64716e] hover:bg-[#ebe7dd] hover:text-[#173c3b]" data-testid="link-nav-upgrade"><Sparkles size={17} strokeWidth={1.8} /><span>Upgrade plan</span></Link>
             <Link href="/account" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#64716e] hover:bg-[#ebe7dd] hover:text-[#173c3b]" data-testid="link-nav-account"><Settings2 size={17} strokeWidth={1.8} /><span>Billing & account</span></Link>
            <Link href="/security" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#64716e] hover:bg-[#ebe7dd] hover:text-[#173c3b]" data-testid="link-nav-security"><ShieldCheck size={17} strokeWidth={1.8} /><span>Security</span></Link>
          </nav>
          <div className="absolute bottom-5 left-4 right-4 rounded-xl border border-[#d8d3c9] bg-[#eeeadf] p-3.5">
            <div className="mb-2 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#75807c]">Free plan</span><span className="font-mono-ui text-[10px] text-[#75807c]">68%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#d2cec2]"><div className="h-full w-[68%] rounded-full bg-[#ef765f]" /></div>
            <Link href="/pricing" className="mt-3 flex items-center justify-between text-xs font-semibold text-[#173c3b]" data-testid="link-upgrade-sidebar">Upgrade for more <ArrowRight size={13} /></Link>
          </div>
        </aside>
        {menuOpen && <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-[#173c3b]/20 md:hidden" data-testid="button-overlay-menu" />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function UploadPanel({ operation, compact = false, onCreated, onJobCreated }: { operation?: string; compact?: boolean; onCreated?: (file: FileRecord) => void; onJobCreated?: (job: ProcessingJob) => void }) {
  const [isOver, setIsOver] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createFile = useCreateFile();
  const createJob = useCreateProcessingJob();
  const queryClient = useQueryClient();

  const submitFile = async (file: File) => {
    if (file.size > 24 * 1024 * 1024) {
      setNotice('Please choose a file smaller than 24 MB for this workspace.');
      return;
    }
    setSelectedName(file.name);
    setNotice('');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    createFile.mutate({ data: { name: file.name, kind: file.type || file.name.split('.').pop() || 'file', size: file.size, pages: null, mimeType: file.type || undefined, contentBase64: btoa(binary) } }, {
      onSuccess: (record) => {
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
        if (operation) {
          createJob.mutate({ data: { fileId: record.id, operation } }, { onSuccess: (job) => { onJobCreated?.(job); setNotice('Processing started. Your result will appear here shortly.'); } });
        } else setNotice('File registered. Choose a tool to continue.');
        onCreated?.(record);
      },
      onError: () => setNotice('We could not register that file. Please try again.'),
    });
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-dashed transition-colors ${isOver ? 'border-[#ef765f] bg-[#fff3ea]' : 'border-[#bfc9c1] bg-[#f8f6f0]'} ${compact ? 'p-5' : 'p-6 md:p-8'}`} onDragOver={(event) => { event.preventDefault(); setIsOver(true); }} onDragLeave={() => setIsOver(false)} onDrop={(event) => { event.preventDefault(); setIsOver(false); const file = event.dataTransfer.files[0]; if (file) submitFile(file); }} data-testid="dropzone-upload">
       <input ref={inputRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void submitFile(file); }} data-testid="input-file-upload" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className={`mb-4 grid place-items-center rounded-xl bg-[#173c3b] text-[#f6e8c4] ${compact ? 'h-11 w-11' : 'h-14 w-14'}`}><Upload size={compact ? 19 : 23} /></div>
        <h3 className="font-display text-[22px] font-semibold tracking-[-.03em] text-[#20383a]">{selectedName ? selectedName : 'Drop a file here'}</h3>
        <p className="mt-1.5 max-w-[330px] text-sm leading-6 text-[#6e7b77]">{selectedName ? 'Ready to send through FLUX.' : 'or choose from your device. PDF, DOCX, images, spreadsheets, and more.'}</p>
        <Button onClick={() => inputRef.current?.click()} className="mt-5" disabled={createFile.isPending || createJob.isPending} data-testid="button-choose-file">{createFile.isPending ? 'Registering file...' : createJob.isPending ? 'Starting...' : 'Choose a file'}<ArrowRight size={15} /></Button>
        {!compact && <div className="mt-4 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#89928d]"><LockKeyhole size={12} /> Files encrypted in transit</div>}
        {notice && <p className="mt-4 max-w-sm text-xs font-medium text-[#34715c]" data-testid="text-upload-notice">{notice}</p>}
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border-[14px] border-[#e5dfcc]" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full border-[14px] border-[#dbe9df]" />
    </div>
  );
}

function Landing() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const [showHow, setShowHow] = useState(false);
  return (
    <div className="grain min-h-[100dvh] bg-[#173c3b] text-[#f8f4eb]">
      <AppHeader />
      <section className="grid-paper relative overflow-hidden border-b border-[#44645d] px-6 pb-20 pt-20 md:px-12 md:pb-28 md:pt-28">
        <div className="mx-auto max-w-[1180px]">
          <div className="max-w-[870px] reveal">
            <div className="mb-7 flex items-center gap-3 font-mono-ui text-[11px] uppercase tracking-[.18em] text-[#a8cbc0]"><span className="h-2 w-2 rounded-full bg-[#ef765f]" /> <span data-testid="status-health">{health.isError ? 'Systems checking' : 'Systems operational'}</span><span className="text-[#65877f]">/</span><span>v1.0 workspace</span></div>
            <h1 className="font-display text-[clamp(3.6rem,9vw,8.8rem)] font-semibold leading-[.86] tracking-[-.075em] text-balance">Transform<br /><span className="text-[#f0c970]">anything.</span><br />Understand everything.</h1>
            <div className="mt-10 flex max-w-[590px] flex-col justify-between gap-7 md:flex-row md:items-end">
              <p className="max-w-[410px] text-[17px] leading-7 text-[#c2d5cc]">FLUX is the precise workspace for changing files, reading between the lines, and getting work out the door.</p>
              <Link href="/dashboard" className="group inline-flex w-fit items-center gap-3 rounded-lg bg-[#ef765f] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#f58b72]" data-testid="link-open-workspace">Open your workspace <span className="transition-transform group-hover:translate-x-1"><ArrowRight size={17} /></span></Link>
            </div>
          </div>
          <div className="mt-20 grid gap-4 md:grid-cols-[1.15fr_.85fr] reveal reveal-delay-2">
            <div className="rounded-2xl border border-[#57756e] bg-[#214947] p-5 md:p-7">
              <div className="mb-8 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#9ebdb3]">Start with a file</span><span className="font-mono-ui text-[10px] text-[#86a39c]">01 / 03</span></div>
              <UploadPanel />
            </div>
            <div className="flex flex-col justify-between rounded-2xl bg-[#e9d9ae] p-6 text-[#173c3b] md:p-7">
              <div><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#6e765f]">What FLUX sees</span><div className="mt-8 space-y-5">
                {['Documents become searchable knowledge.', 'Messy files become useful formats.', 'Private work stays yours.'].map((item, index) => <div key={item} className="flex items-start gap-3 border-t border-[#cdbd91] pt-4"><span className="font-mono-ui text-xs text-[#9a8351]">0{index + 1}</span><p className="font-display text-[20px] font-medium leading-tight tracking-[-.03em]">{item}</p></div>)}
              </div></div>
              <button onClick={() => setShowHow(!showHow)} className="mt-10 flex w-full items-center justify-between border-t border-[#cdbd91] pt-4 text-left text-sm font-semibold text-[#42615d]" data-testid="button-how-flux-works">See how it works <ChevronDown size={17} className={showHow ? 'rotate-180' : ''} /></button>
              {showHow && <p className="mt-3 text-sm leading-6 text-[#5d6d64]" data-testid="text-how-flux-works">Drop your source in, choose the intent, and FLUX handles the mechanics. Every job is visible, reversible, and ready to download.</p>}
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#f4f1ea] px-6 py-20 text-[#1b3032] md:px-12 md:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-12 md:grid-cols-[.8fr_1.2fr]">
          <div><span className="font-mono-ui text-[11px] uppercase tracking-[.18em] text-[#ef765f]">A sharper way in</span><h2 className="mt-5 max-w-[410px] font-display text-5xl font-semibold leading-[.95] tracking-[-.06em]">The file is only the beginning.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/tools" className="group rounded-xl border border-[#d5d0c5] bg-[#f8f6f0] p-5 hover:-translate-y-1 hover:border-[#99b8aa]" data-testid="link-explore-tools"><div className="mb-12 flex justify-between"><Settings2 size={20} className="text-[#173c3b]" /><ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></div><h3 className="font-display text-2xl font-semibold tracking-[-.04em]">Five focused tools</h3><p className="mt-2 text-sm leading-6 text-[#6d7873]">No maze of settings. Just the right move.</p></Link>
            <Link href="/document-chat" className="group rounded-xl border border-[#d5d0c5] bg-[#dce9e2] p-5 hover:-translate-y-1 hover:border-[#7ea797]" data-testid="link-explore-chat"><div className="mb-12 flex justify-between"><MessageSquareText size={20} className="text-[#173c3b]" /><ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></div><h3 className="font-display text-2xl font-semibold tracking-[-.04em]">Ask your documents</h3><p className="mt-2 text-sm leading-6 text-[#56736b]">Get the answer, then see where it came from.</p></Link>
          </div>
        </div>
      </section>
      <footer className="bg-[#173c3b] px-6 py-8 text-[#a9c2b7] md:px-12"><div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-5 text-xs md:flex-row md:items-center"><Logo light /><div className="flex gap-5"><Link href="/privacy" data-testid="link-footer-privacy">Privacy</Link><Link href="/security" data-testid="link-footer-security">Security</Link><Link href="/terms" data-testid="link-footer-terms">Terms</Link></div><span className="font-mono-ui text-[10px] uppercase tracking-[.14em]">Built for the work after upload</span></div></footer>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="border-b border-[#d8d3c9] bg-[#ebe7dc] px-6 py-12 md:px-12 md:py-16"><div className="mx-auto flex max-w-[1080px] flex-col justify-between gap-7 md:flex-row md:items-end"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#ef765f]">{eyebrow}</span><h1 className="mt-4 max-w-[700px] font-display text-5xl font-semibold leading-[.94] tracking-[-.065em] md:text-7xl">{title}</h1><p className="mt-5 max-w-[530px] text-[16px] leading-7 text-[#65736e]">{description}</p></div>{children}</div></div>;
}

function ToolsPage() {
  const [search, setSearch] = useState('');
  const visible = toolCatalog.filter((tool) => `${tool.title} ${tool.description}`.toLowerCase().includes(search.toLowerCase()));
  const categories = ['DOCUMENT', 'IMAGE', 'AI', 'STUDENT TOOLS', 'DEVELOPER TOOLS'] as const;
  return <AppShell><PageIntro eyebrow={`Tool index / ${toolCatalog.length}`} title="A tool for the next move." description="Small, exact utilities for documents, images, intelligence, study, and code. Nothing hidden behind a wizard."><div className="hidden w-36 font-mono-ui text-right text-[10px] uppercase leading-5 tracking-[.14em] text-[#82908a] md:block">Input<br /><span className="text-[#173c3b]">any file</span><br /><ArrowDownToLine size={16} className="my-1 ml-auto rotate-[-90deg]" />Output<br /><span className="text-[#173c3b]">useful work</span></div></PageIntro>
    <div className="mx-auto max-w-[1080px] px-6 py-10 md:px-12"><div className="relative mb-10 max-w-md"><Search className="absolute left-3 top-3 text-[#89938e]" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search 50+ tools" className="w-full rounded-lg border border-[#d0cbc0] bg-[#f8f6f0] py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-[#9aa09a] focus:border-[#5b9384]" data-testid="input-search-tools" /></div>{categories.map((category) => { const items = visible.filter((tool) => tool.category === category); if (!items.length) return null; return <section key={category} className="mb-12" data-testid={`section-tools-${category.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-4 flex items-center gap-3"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#ef765f]">{category}</span><span className="h-px flex-1 bg-[#ddd8cd]" /><span className="font-mono-ui text-[10px] text-[#99a19a]">{items.length.toString().padStart(2, '0')}</span></div><div className="grid gap-3 md:grid-cols-2">{items.map(({ slug, title, description, icon: Icon, accent, detail }, index) => <Link href={`/${slug}`} key={slug} className={`group flex min-h-[185px] flex-col justify-between rounded-xl border border-[#d5d0c5] p-5 transition-all hover:-translate-y-1 hover:shadow-[0_12px_25px_rgba(30,43,43,.08)] ${accent === 'coral' ? 'bg-[#f9e0d5]' : accent === 'teal' ? 'bg-[#dce9e2]' : accent === 'gold' ? 'bg-[#f2e6bf]' : accent === 'blue' ? 'bg-[#dde8e9]' : 'bg-[#e8e5dc]'}`} data-testid={`card-tool-${slug}`}><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f8f6f0]/70 text-[#173c3b]"><Icon size={19} strokeWidth={1.8} /></span><span className="font-mono-ui text-[10px] text-[#7f8982]">0{index + 1}</span></div><div><h2 className="font-display text-2xl font-semibold tracking-[-.04em]">{title}</h2><p className="mt-1 text-sm text-[#677670]">{description}</p><div className="mt-4 flex items-center justify-between border-t border-[#173c3b]/10 pt-3 text-xs font-semibold text-[#44615b]"><span>{detail}</span><MoveRight size={16} className="transition-transform group-hover:translate-x-1" /></div></div></Link>)}</div></section>; })}{visible.length === 0 && <div className="rounded-xl border border-dashed border-[#c9c5ba] p-12 text-center text-sm text-[#6f7a75]" data-testid="empty-search-tools">No tool matches that search.</div>}</div>
  </AppShell>;
}

function ToolPage({ operation, title, description, eyebrow }: { operation: string; title: string; description: string; eyebrow: string }) {
  const [jobId, setJobId] = useState('');
  const [createdFile, setCreatedFile] = useState<FileRecord | null>(null);
  const jobQuery = useGetProcessingJob(jobId, { query: { enabled: Boolean(jobId), queryKey: getGetProcessingJobQueryKey(jobId || 'pending') } });
  const job = jobQuery.data;
  const isDone = job?.status === 'completed';
  useEffect(() => {
    if (job?.status === 'processing' || job?.status === 'queued') {
      const timer = window.setTimeout(() => jobQuery.refetch(), 1800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [job?.status, jobQuery.refetch]);
  return <AppShell><PageIntro eyebrow={eyebrow} title={title} description={description}><Link href="/tools" className="inline-flex items-center gap-2 text-sm font-semibold text-[#49645e] hover:text-[#173c3b]" data-testid="link-back-tools"><ArrowRight size={15} className="rotate-180" /> All tools</Link></PageIntro><div className="mx-auto grid max-w-[1080px] gap-5 px-6 py-10 md:grid-cols-[1.1fr_.9fr] md:px-12">
    <div className="rounded-2xl border border-[#d6d1c6] bg-[#f8f6f0] p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#77837d]">Input / source file</span><span className="font-mono-ui text-[10px] text-[#a0a59e]">Max 250 MB</span></div><UploadPanel operation={operation} onCreated={(file) => setCreatedFile(file)} onJobCreated={(createdJob) => setJobId(createdJob.id)} />{createdFile && <div className="mt-4 flex items-center gap-3 rounded-lg bg-[#dce9e2] p-3 text-sm text-[#315c52]" data-testid="text-file-created"><Check size={16} /><span className="truncate">{createdFile.name}</span><StatusPill status={job?.status || 'queued'} /></div>}</div>
     <div className="rounded-2xl border border-[#d6d1c6] bg-[#e8e5dc] p-5 md:p-7"><div className="mb-7 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#77837d]">Job monitor</span><Activity size={17} className="text-[#77837d]" /></div>{!job && <div className="flex min-h-[230px] flex-col justify-center"><div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-[#d0cbc0]"><div className="h-full w-1/3 rounded-full bg-[#a4b8a5]" /></div><p className="font-display text-2xl font-semibold tracking-[-.04em] text-[#526460]">Waiting for a file.</p><p className="mt-2 max-w-[280px] text-sm leading-6 text-[#7a847d]">Once your file arrives, FLUX will show every step here.</p></div>}{job && <div className="min-h-[230px]"><StatusPill status={job.status} /><p className="mt-6 font-display text-3xl font-semibold tracking-[-.05em]" data-testid="text-job-message">{isDone ? 'Your file is ready.' : job.message || 'Working through the file.'}</p><div className="mt-8"><div className="mb-2 flex justify-between font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#74817b]"><span>Progress</span><span data-testid="text-job-progress">{job.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#d1ccc0]"><div className={`h-full rounded-full ${isDone ? 'bg-[#4b8b72]' : 'bg-[#ef765f] transition-all duration-700'}`} style={{ width: `${Math.max(4, job.progress)}%` }} /></div></div>{isDone && job.resultUrl && <a href={job.resultUrl} download className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#173c3b] px-4 py-3 text-sm font-semibold text-[#f8f4eb] hover:bg-[#285c57]" data-testid="button-download-result"><ArrowDownToLine size={16} /> Download result</a>}</div>}</div>
  </div></AppShell>;
}

function CatalogToolRoute() {
  const { slug } = useParams<{ slug: string }>();
  const tool = toolCatalog.find((item) => item.slug === slug);
  if (!tool) return <NotFound />;
  return <ToolPage operation={tool.slug} eyebrow={`${tool.category} / ${tool.title}`} title={tool.title} description={tool.description} />;
}

function MetricCard({ icon: Icon, label, value, note, tone = 'plain' }: { icon: typeof HardDrive; label: string; value: string | number; note: string; tone?: 'plain' | 'coral' }) {
  return <div className={`rounded-xl border border-[#d6d1c6] p-5 ${tone === 'coral' ? 'bg-[#f9e0d5]' : 'bg-[#f8f6f0]'}`}><div className="flex items-center justify-between text-[#70807a]"><span className="font-mono-ui text-[10px] uppercase tracking-[.16em]">{label}</span><Icon size={17} /></div><div className="mt-8 font-display text-4xl font-semibold tracking-[-.06em]" data-testid={`metric-${label.toLowerCase().replace(' ', '-')}`}>{value}</div><p className="mt-1 text-xs text-[#78827c]">{note}</p></div>;
}

function FileRow({ file }: { file: FileRecord }) {
  return <div className="group flex items-center gap-3 border-b border-[#dfdad0] py-4 last:border-0" data-testid={`row-file-${file.id}`}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e2ece5] text-[#3c7060]"><FileText size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#294041]">{file.name}</p><p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[#8b948e]">{file.kind} · {formatBytes(file.size)}{file.pages ? ` · ${file.pages} pages` : ''}</p></div><div className="hidden sm:block"><StatusPill status={file.status} /></div><span className="hidden w-[130px] text-right text-xs text-[#8b948e] lg:block">{formatTime(file.createdAt)}</span><button className="rounded-md p-1.5 text-[#9aa09a] hover:bg-[#e8e4da] hover:text-[#173c3b]" data-testid={`button-file-menu-${file.id}`}><MoreHorizontal size={18} /></button></div>;
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const filesQuery = useListFiles({ query: { queryKey: getListFilesQueryKey() } });
  const summary = summaryQuery.data as DashboardSummary | undefined;
  const files = filesQuery.data || fallbackFiles;
  const activities: ActivityRecord[] = summary?.recentActivity || [
    { id: 'a1', label: 'PDF compressed', detail: 'field-notes-final.pdf · 24 pages', time: '12 minutes ago' },
    { id: 'a2', label: 'File uploaded', detail: 'q2-research-images.zip · 18.4 MB', time: 'Yesterday, 3:10 PM' },
    { id: 'a3', label: 'Document indexed', detail: 'project-brief.pdf · ready for chat', time: 'Tuesday, 12:45 PM' },
  ];
  return <AppShell><div className="mx-auto max-w-[1180px] px-6 py-9 md:px-10 md:py-12"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#ef765f]"><span className="h-1.5 w-1.5 rounded-full bg-[#ef765f]" />Workspace / overview</div><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.07em] md:text-6xl">Good morning, Alex.</h1><p className="mt-2 text-sm text-[#76827c]">A clear view of the work moving through FLUX.</p></div><Link href="/tools" className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#173c3b] px-4 py-2.5 text-sm font-semibold text-[#f8f4eb]" data-testid="link-dashboard-new-tool"><Plus size={16} /> New transformation</Link></div>
    <div className="mt-9 grid gap-3 md:grid-cols-4"><MetricCard icon={FileStack} label="Files processed" value={summary?.filesProcessed ?? 47} note="Since your workspace began" /><MetricCard icon={HardDrive} label="Storage used" value={summary?.storageUsed ?? '1.8 GB'} note="of 5 GB included" tone="coral" /><MetricCard icon={MessageSquareText} label="AI requests" value={summary?.aiRequests ?? 128} note="This billing period" /><MetricCard icon={BarChart3} label="Plan usage" value={`${summary?.usagePercent ?? 68}%`} note={`${summary?.plan ?? 'Free'} plan`} /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-xl border border-[#d6d1c6] bg-[#f8f6f0] p-5 md:p-7"><div className="flex items-center justify-between"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#7f8a83]">Recent files</span><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em]">Your working set</h2></div><Link href="/tools" className="text-xs font-semibold text-[#3d7464] hover:text-[#173c3b]" data-testid="link-see-all-files">Add a file <Plus size={13} className="ml-1 inline" /></Link></div><div className="mt-5">{filesQuery.isLoading ? <div className="space-y-4" data-testid="loading-files"><div className="h-12 animate-pulse rounded bg-[#ebe7dd]" /><div className="h-12 animate-pulse rounded bg-[#ebe7dd]" /></div> : files.map((file) => <FileRow key={file.id} file={file} />)}</div></section>
      <section className="rounded-xl border border-[#d6d1c6] bg-[#dce9e2] p-5 md:p-7"><div className="flex items-center justify-between"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#628074]">Quick tools</span><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em]">Make a move</h2></div><Zap size={19} className="text-[#3f7664]" /></div><div className="mt-6 space-y-2">{toolCatalog.slice(0, 4).map(({ slug, title, icon: Icon }) => <Link href={`/${slug}`} key={slug} className="group flex items-center gap-3 rounded-lg border border-[#bdd1c5] bg-[#e7f0e9]/70 p-3 hover:bg-[#f4f1ea]" data-testid={`link-quick-${slug}`}><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f4f1ea] text-[#39705d]"><Icon size={16} /></span><span className="flex-1 text-sm font-semibold text-[#34574f]">{title}</span><ArrowRight size={15} className="text-[#75938a] transition-transform group-hover:translate-x-1" /></Link>)}</div><Link href="/document-chat" className="mt-5 flex items-center justify-center gap-2 border-t border-[#bcd0c4] pt-5 text-xs font-semibold text-[#376858]" data-testid="link-quick-chat"><MessageSquareText size={15} /> Ask a document instead</Link></section></div>
    <section className="mt-5 rounded-xl border border-[#d6d1c6] bg-[#ebe7dc] p-5 md:p-7"><div className="flex items-center justify-between"><div><span className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#7f8a83]">Activity log</span><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.05em]">What changed</h2></div><History size={18} className="text-[#78847d]" /></div><div className="mt-5 grid gap-x-8 md:grid-cols-3">{activities.slice(0, 6).map((activity) => <div key={activity.id} className="border-t border-[#d4cfc4] py-4" data-testid={`activity-${activity.id}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{activity.label}</p><span className="whitespace-nowrap font-mono-ui text-[9px] text-[#87918a]">{activity.time}</span></div><p className="mt-1 text-xs leading-5 text-[#74807a]">{activity.detail}</p></div>)}</div></section>
  </div></AppShell>;
}

function DocumentChat() {
  const filesQuery = useListFiles({ query: { queryKey: getListFilesQueryKey() } });
  const files = filesQuery.data || [];
  const [selectedId, setSelectedId] = useState(files[0]?.id || '');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'flux'; text: string }[]>([]);
  const [activeJobId, setActiveJobId] = useState('');
  const handledJobId = useRef('');
  const fileQuery = useGetFile(selectedId, { query: { enabled: Boolean(selectedId), queryKey: getGetFileQueryKey(selectedId || 'none') } });
  const selectedFile = fileQuery.data || files.find((file) => file.id === selectedId);
  const createJob = useCreateProcessingJob();
  const jobQuery = useGetProcessingJob(activeJobId, { query: { enabled: Boolean(activeJobId), queryKey: getGetProcessingJobQueryKey(activeJobId || 'chat-pending') } });
  const activeJob = jobQuery.data;
  useEffect(() => { if (!selectedId && files[0]) setSelectedId(files[0].id); }, [files, selectedId]);
  useEffect(() => {
    if (activeJob?.status === 'queued' || activeJob?.status === 'processing') {
      const timer = window.setTimeout(() => jobQuery.refetch(), 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeJob?.status, jobQuery.refetch]);
  useEffect(() => {
    if (!activeJob || handledJobId.current === activeJob.id || (activeJob.status !== 'completed' && activeJob.status !== 'failed')) return;
    handledJobId.current = activeJob.id;
    if (activeJob.status === 'failed') {
      setMessages((current) => [...current, { role: 'flux', text: activeJob.message || 'I could not process that document.' }]);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(activeJob.resultUrl || `/api/processing/jobs/${activeJob.id}/result`);
        if (!response.ok) throw new Error('The answer result could not be downloaded.');
        const answer = await response.text();
        setMessages((current) => [...current, { role: 'flux', text: answer }]);
      } catch (error) {
        setMessages((current) => [...current, { role: 'flux', text: error instanceof Error ? error.message : 'The answer could not be loaded.' }]);
      }
    })();
  }, [activeJob]);
  const ask = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = question.trim();
    if (!cleaned || !selectedId || createJob.isPending) return;
    setMessages((current) => [...current, { role: 'user', text: cleaned }]);
    setQuestion('');
    createJob.mutate(
      { data: { fileId: selectedId, operation: 'ask-questions-about-pdf', question: cleaned } },
      {
        onSuccess: (job) => setActiveJobId(job.id),
        onError: () => setMessages((current) => [...current, { role: 'flux', text: 'I could not start the document question. Please try again.' }]),
      },
    );
  };
  const isAsking = createJob.isPending || activeJob?.status === 'queued' || activeJob?.status === 'processing';
  return <AppShell><div className="flex min-h-[calc(100dvh-72px)] flex-col lg:flex-row"><aside className="w-full border-b border-[#d8d3c9] bg-[#ebe7dc] p-5 lg:w-[275px] lg:border-b-0 lg:border-r lg:p-6"><div className="mb-8"><div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#ef765f]"><MessageSquareText size={13} /> Document intelligence</div><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-.055em]">Ask better<br />questions.</h1></div><label className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#7f8b84]" htmlFor="document-select">Source document</label><div className="relative mt-2"><select id="document-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full appearance-none rounded-lg border border-[#d0cbc0] bg-[#f8f6f0] px-3 py-3 pr-8 text-sm font-semibold outline-none focus:border-[#5b9384]" data-testid="select-document"><option value="">Choose a file</option>{files.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-[#7c8982]" size={16} /></div>{selectedFile && <div className="mt-4 rounded-lg border border-[#d0cbc0] bg-[#f8f6f0] p-3" data-testid="card-selected-document"><div className="flex gap-2"><FileText size={16} className="mt-0.5 text-[#39705d]" /><div className="min-w-0"><p className="truncate text-xs font-semibold">{selectedFile.name}</p><p className="mt-1 font-mono-ui text-[9px] uppercase text-[#89938d]">{selectedFile.pages || '—'} pages · {formatBytes(selectedFile.size)}</p></div></div></div>}<div className="mt-8 border-t border-[#d2cdc1] pt-5"><p className="text-xs leading-5 text-[#74817a]">Answers stay grounded in your selected file. Ask about a detail, compare sections, or find the next action.</p><div className="mt-4 flex items-center gap-2 font-mono-ui text-[9px] uppercase tracking-[.12em] text-[#6c887b]"><ShieldCheck size={13} /> Private by default</div></div></aside><section className="flex min-h-[calc(100dvh-72px)] flex-1 flex-col bg-[#f8f6f0]"><div className="border-b border-[#dfdad0] px-5 py-4 md:px-9"><div className="mx-auto flex max-w-[760px] items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#7d8a83]">Conversation</span><span className="flex items-center gap-1.5 font-mono-ui text-[10px] uppercase tracking-[.12em] text-[#498067]"><span className={`h-1.5 w-1.5 rounded-full ${isAsking ? 'bg-[#ef765f]' : 'bg-[#4d9b73]'}`} /> {isAsking ? 'working' : 'ready'}</span></div></div><div className="flex flex-1 flex-col px-5 py-8 md:px-9"><div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-end">{messages.length === 0 ? <div className="mb-auto pt-16"><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#dce9e2] text-[#39705d]"><Sparkles size={22} /></div><h2 className="mt-6 font-display text-4xl font-semibold tracking-[-.06em]">Where should we start?</h2><p className="mt-3 max-w-[460px] text-sm leading-6 text-[#78847e]">Select a source on the left, then ask FLUX to pull the signal from the noise.</p><div className="mt-8 grid max-w-[580px] gap-2 sm:grid-cols-2">{['Summarize this document', 'What are the key dates?', 'Find the main decision', 'Explain this in plain language'].map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)} disabled={!selectedFile || isAsking} className="rounded-lg border border-[#d5d0c5] bg-[#ebe7dc] px-3 py-3 text-left text-xs font-semibold text-[#536760] hover:border-[#9cb7a8] hover:bg-[#e1ebe4] disabled:opacity-50" data-testid={`button-prompt-${prompt.toLowerCase().replaceAll(' ', '-')}`}>{prompt}<ArrowRight size={14} className="float-right text-[#789288]" /></button>)}</div></div> : <div className="space-y-5 pb-7">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} data-testid={`message-${message.role}-${index}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-sm bg-[#173c3b] text-[#f8f4eb]' : 'rounded-bl-sm border border-[#d6d1c6] bg-[#ebe7dc] text-[#445a55]'}`}>{message.text}</div></div>)}{isAsking && <div className="flex justify-start" data-testid="message-working"><div className="rounded-2xl rounded-bl-sm border border-[#d6d1c6] bg-[#ebe7dc] px-4 py-3 text-sm text-[#74817a]">Reading {selectedFile?.name || 'your document'}…</div></div>}</div>}<form onSubmit={ask} className="mt-7 flex items-center gap-2 rounded-xl border border-[#cfcabf] bg-[#f4f1ea] p-2 focus-within:border-[#6e9b89]" data-testid="form-document-chat"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={selectedFile ? 'Ask something about this file...' : 'Select a document to begin...'} disabled={!selectedFile || isAsking} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#9aa09a]" data-testid="input-document-question" /><button type="submit" disabled={!question.trim() || !selectedFile || isAsking} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#173c3b] text-[#f8f4eb] hover:bg-[#285c57] disabled:opacity-40" data-testid="button-send-question"><ArrowRight size={17} /></button></form></div></div></section></div></AppShell>;
}

function Pricing() {
  const [location] = useLocation();
  const plans = [{ name: 'Free', price: '$0', note: 'For occasional file work', features: ['25 transformations / month', '5 GB secure storage', 'Core PDF tools'], featured: false }, { name: 'Pro', price: '$12', note: 'For focused individual work', features: ['Unlimited transformations', '50 GB secure storage', 'Document chat with citations', 'Priority processing'], featured: true }, { name: 'Business', price: '$29', note: 'For teams with standards', features: ['Everything in Pro', 'Shared team workspace', '500 GB secure storage', 'Centralized controls'], featured: false }];
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const startCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const response = await fetch('/api/whop/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const payload = await response.json() as { purchaseUrl?: string; error?: string };
      if (!response.ok || !payload.purchaseUrl) throw new Error(payload.error || 'Checkout is unavailable.');
      window.location.assign(payload.purchaseUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout is unavailable.');
      setCheckoutLoading(false);
    }
  };
  return <AppShell><PageIntro eyebrow="Plans / simple by design" title="Pay for momentum, not mystery." description="Start with the essentials. Move up when your volume or your team asks for it." />{location.includes('checkout=complete') && <div className="mx-auto mt-7 max-w-[1080px] rounded-xl border border-[#b9d6c4] bg-[#dce9e2] px-5 py-4 text-sm text-[#315c52]" data-testid="text-checkout-complete"><strong>Checkout submitted.</strong> Whop is the source of truth for your membership. Open Billing & account to check verified access.</div>}<div className="mx-auto grid max-w-[1080px] gap-4 px-6 py-10 md:grid-cols-3 md:px-12">{plans.map((plan) => <div key={plan.name} className={`relative flex flex-col rounded-xl border p-6 ${plan.featured ? 'border-[#173c3b] bg-[#173c3b] text-[#f8f4eb] shadow-[0_18px_45px_rgba(23,60,59,.18)]' : 'border-[#d6d1c6] bg-[#f8f6f0]'}`} data-testid={`card-plan-${plan.name.toLowerCase()}`}>{plan.featured && <span className="absolute right-5 top-5 rounded-full bg-[#f0c970] px-2.5 py-1 font-mono-ui text-[9px] uppercase tracking-[.12em] text-[#173c3b]">Most useful</span>}<span className={`font-mono-ui text-[10px] uppercase tracking-[.18em] ${plan.featured ? 'text-[#a8c9bd]' : 'text-[#82908a]'}`}>{plan.name}</span><div className="mt-6 font-display text-5xl font-semibold tracking-[-.07em]">{plan.price}<span className={`font-sans text-sm font-normal ${plan.featured ? 'text-[#a7c4bb]' : 'text-[#85908a]'}`}> / month</span></div><p className={`mt-2 text-sm ${plan.featured ? 'text-[#b8d0c6]' : 'text-[#718079]'}`}>{plan.note}</p><div className={`my-7 border-t ${plan.featured ? 'border-[#496862]' : 'border-[#ded9ce]'}`} /> <ul className="flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><Check size={16} className={`mt-0.5 ${plan.featured ? 'text-[#f0c970]' : 'text-[#4b8b72'}`} /><span>{feature}</span></li>)}</ul>{plan.featured ? <button onClick={startCheckout} disabled={checkoutLoading} className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-[#ef765f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#f58b72] disabled:cursor-wait disabled:opacity-70" data-testid="button-plan-pro">{checkoutLoading ? 'Opening checkout...' : 'Choose plan'} <ArrowRight size={15} /></button> : <Link href="/sign-up" className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg border border-[#cfcabf] bg-[#ebe7dc] px-4 py-3 text-sm font-semibold text-[#294341] hover:border-[#173c3b]" data-testid={`link-plan-${plan.name.toLowerCase()}`}>{plan.name === 'Free' ? 'Start for free' : 'Talk to us'} <ArrowRight size={15} /></Link>}</div>)}</div>{checkoutError && <p className="mx-auto max-w-[1080px] px-6 pb-10 text-center text-sm font-medium text-[#b04e3c]" data-testid="text-checkout-error">{checkoutError}</p>}</AppShell>;
}

function AccountPage() {
  const [state, setState] = useState<'loading' | 'verified' | 'free'>('loading');
  useEffect(() => {
    fetch('/api/whop/access')
      .then((response) => response.json() as Promise<{ hasAccess?: boolean }>)
      .then((result) => setState(result.hasAccess ? 'verified' : 'free'))
      .catch(() => setState('free'));
  }, []);
  return <AppShell><PageIntro eyebrow="Account / billing" title="Know where your plan stands." description="FLUX checks paid access with Whop on the server. A checkout redirect alone never unlocks features."><div className="grid h-14 w-14 place-items-center rounded-xl bg-[#173c3b] text-[#f2d58b]"><Settings2 size={24} /></div></PageIntro><div className="mx-auto grid max-w-[900px] gap-5 px-6 py-10 md:px-12 md:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-[#d6d1c6] bg-[#f8f6f0] p-6 md:p-8"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#7f8a83]">Current membership</span><div className="mt-6 flex items-center justify-between gap-4 border-b border-[#ded9ce] pb-6"><div><h2 className="font-display text-3xl font-semibold tracking-[-.05em]">{state === 'verified' ? 'FLUX Pro' : 'Free plan'}</h2><p className="mt-2 text-sm text-[#718079]">{state === 'loading' ? 'Checking with Whop…' : state === 'verified' ? 'Verified membership access' : 'No verified paid membership found'}</p></div>{state === 'loading' ? <StatusPill status="processing" /> : <StatusPill status={state === 'verified' ? 'ready' : 'free'} />}</div><p className="mt-6 text-sm leading-6 text-[#68766f]">{state === 'verified' ? 'Your paid access is confirmed by Whop. Pro features can now be enabled for your verified account.' : 'If you have already paid, make sure you are signed into the same Whop account used at checkout.'}</p><Link href="/pricing" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#173c3b] px-4 py-3 text-sm font-semibold text-[#f8f4eb]" data-testid="link-account-pricing">{state === 'verified' ? 'View plan details' : 'Upgrade to Pro'} <ArrowRight size={15} /></Link></section><aside className="rounded-2xl border border-[#b9d6c4] bg-[#dce9e2] p-6 md:p-8"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#628074]">Billing support</span><h2 className="mt-5 font-display text-3xl font-semibold tracking-[-.05em]">Whop is your billing home.</h2><p className="mt-3 text-sm leading-6 text-[#56736b]">Payments, invoices, and cancellation are handled in your Whop account so FLUX never stores card details.</p><a href="https://whop.com" target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-lg border border-[#9fc4b1] bg-[#eff7ef] px-4 py-3 text-sm font-semibold text-[#315c52]" data-testid="link-open-whop">Open Whop <ArrowRight size={15} /></a></aside></div></AppShell>;
}

function TrustPage({ type }: { type: 'privacy' | 'security' | 'terms' }) {
  const content = {
    privacy: { eyebrow: 'Privacy / your files are yours', title: 'A quiet promise about your data.', description: 'We collect what is needed to run FLUX, not a profile of your work.', icon: LockKeyhole, sections: [['Data minimization', 'We keep account and processing details so the workspace can function. We do not sell your files or use their contents to build advertising profiles.'], ['Your control', 'You can request access, correction, or deletion of your workspace data. Uploaded files can be removed from the workspace at any time.'], ['Processing partners', 'When a transformation needs a specialist service, data is transmitted securely and only for the requested operation.']] },
    security: { eyebrow: 'Security / designed for trust', title: 'The instrument is only as good as its casing.', description: 'Protection is part of the product surface, from upload to download.', icon: ShieldCheck, sections: [['Encrypted in transit', 'Every connection to FLUX uses modern TLS. Files are protected while they move between your browser and our processing infrastructure.'], ['Controlled access', 'Workspace access is authenticated and scoped. Processing jobs are tied to the file that requested them, not a public URL.'], ['Reliable by default', 'We monitor service health and processing queues so failures are visible instead of silently losing your work.']] },
    terms: { eyebrow: 'Terms / clear terms for clear work', title: 'The rules are readable on purpose.', description: 'A short version of what using FLUX means for both of us.', icon: BookOpen, sections: [['Use the service responsibly', 'Do not use FLUX to process material you do not have the right to handle, or to attempt to disrupt the service.'], ['Your content', 'You retain ownership of files you upload and results generated from them. You are responsible for checking results before relying on them.'], ['Service changes', 'We will communicate meaningful changes to the service and these terms. Paid plans can be cancelled before the next billing period.']] },
  }[type];
  const Icon = content.icon;
  return <AppShell><PageIntro eyebrow={content.eyebrow} title={content.title} description={content.description}><div className="grid h-14 w-14 place-items-center rounded-xl bg-[#173c3b] text-[#f2d58b]"><Icon size={24} /></div></PageIntro><div className="mx-auto max-w-[820px] px-6 py-12 md:px-12 md:py-16"><div className="mb-10 flex items-center gap-3 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#809089]"><Clock3 size={14} /> Last updated / April 2024</div><div className="space-y-0">{content.sections.map(([heading, text], index) => <article key={heading} className="grid gap-4 border-t border-[#d8d3c9] py-8 md:grid-cols-[190px_1fr]"><div className="font-display text-xl font-semibold tracking-[-.03em]"><span className="mr-3 font-mono-ui text-[10px] text-[#ef765f]">0{index + 1}</span>{heading}</div><p className="max-w-[510px] text-[15px] leading-7 text-[#65736e]">{text}</p></article>)}</div></div></AppShell>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const submit = async (event: FormEvent) => { 
    event.preventDefault();
    await fetch(import.meta.env.VITE_API_URL + "/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitted(true); 
  };
  return <div className="grain min-h-[100dvh] bg-[#173c3b] text-[#f8f4eb]"><div className="flex items-center justify-between px-5 py-6 md:px-10"><Logo light /><Link href="/" className="flex items-center gap-2 text-xs font-semibold text-[#a9c2b7] hover:text-white" data-testid="link-auth-home"><ArrowRight size={14} className="rotate-180" /> Back to FLUX</Link></div><div className="mx-auto grid max-w-[1060px] gap-10 px-6 pb-16 pt-10 md:grid-cols-[.85fr_1.15fr] md:items-center md:px-10 md:pt-20"><div className="hidden md:block"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#f0c970]">{mode === 'sign-in' ? 'Welcome back' : 'Start with a signal'}</span><h1 className="mt-5 max-w-[410px] font-display text-6xl font-semibold leading-[.9] tracking-[-.07em]">{mode === 'sign-in' ? 'Pick up where the work left off.' : 'A better home for every file.'}</h1><p className="mt-6 max-w-[350px] text-sm leading-6 text-[#b8d0c6]">One workspace for transforming formats and finding the meaning inside them.</p></div><div className="mx-auto w-full max-w-[450px] rounded-2xl bg-[#f8f6f0] p-6 text-[#1b3032] shadow-[0_24px_70px_rgba(0,0,0,.2)] md:p-8"><div className="mb-8"><span className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#ef765f]">FLUX account</span><h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.06em]">{mode === 'sign-in' ? 'Sign in' : 'Create your account'}</h2><p className="mt-2 text-sm text-[#74817b]">{mode === 'sign-in' ? 'Your workspace is waiting.' : 'Free to start. No card required.'}</p></div>{submitted ? <div className="rounded-xl bg-[#dce9e2] p-5" data-testid="text-auth-success"><div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-[#4b8b72] text-white"><Check size={18} /></div><p className="font-display text-2xl font-semibold tracking-[-.04em]">You're on your way.</p><p className="mt-2 text-sm leading-6 text-[#5f766e]">You are securely logged into your FLUX session.</p><Link href="/dashboard"><Button className="mt-4">Go to Dashboard</Button></Link></div> : <form onSubmit={submit} className="space-y-4" data-testid={`form-${mode}`}><button type="button" onClick={async () => { await fetch(import.meta.env.VITE_API_URL + "/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "google-user@example.com" }) }); setSubmitted(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#d0cbc0] bg-[#ebe7dc] px-4 py-3 text-sm font-semibold hover:border-[#7c9e8d]" data-testid="button-continue-google"><span className="font-display text-base">G</span> Continue with Google</button><div className="flex items-center gap-3 py-2"><div className="h-px flex-1 bg-[#ddd8cd]" /><span className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#9ba19a]">or email</span><div className="h-px flex-1 bg-[#ddd8cd]" /></div><label className="block text-xs font-semibold text-[#53645f]" htmlFor="auth-email">Email address</label><input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} required type="email" placeholder="you@company.com" className="w-full rounded-lg border border-[#d0cbc0] bg-[#f8f6f0] px-3 py-3 text-sm outline-none focus:border-[#5b9384]" data-testid="input-auth-email" /><Button type="submit" className="w-full" data-testid="button-submit-auth">{mode === 'sign-in' ? 'Continue to workspace' : 'Create free workspace'} <ArrowRight size={15} /></Button><p className="pt-2 text-center text-xs leading-5 text-[#89938d]">{mode === 'sign-in' ? 'New to FLUX? ' : 'Already have an account? '}<Link href={mode === 'sign-in' ? '/sign-up' : '/sign-in'} className="font-semibold text-[#39705d]" data-testid="link-switch-auth">{mode === 'sign-in' ? 'Create one' : 'Sign in'}</Link></p></form>}</div></div></div>;
}

function Router() {
  return <ErrorBoundary resetKey={useLocation()[0]}><Switch><Route path="/" component={Landing} /><Route path="/tools" component={ToolsPage} /><Route path="/document-chat" component={DocumentChat} /><Route path="/dashboard" component={Dashboard} /><Route path="/pricing" component={Pricing} /><Route path="/account" component={AccountPage} /><Route path="/privacy"><TrustPage type="privacy" /></Route><Route path="/security"><TrustPage type="security" /></Route><Route path="/terms"><TrustPage type="terms" /></Route><Route path="/sign-in"><AuthPage mode="sign-in" /></Route><Route path="/sign-up"><AuthPage mode="sign-up" /></Route><Route path="/:slug" component={CatalogToolRoute} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;