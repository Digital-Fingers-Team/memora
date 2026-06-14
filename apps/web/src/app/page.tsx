"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  CalendarCheck,
  ChartNetwork,
  FileText,
  Inbox,
  Loader2,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import { ApiClient, type Decision, type GraphData, type KnowledgeObject, type Report, type Session } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "knowledge", label: "Knowledge", icon: Brain },
  { id: "graph", label: "Graph", icon: ChartNetwork },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "decisions", label: "Decisions", icon: CalendarCheck },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

type NavId = (typeof navItems)[number]["id"];
type ChatMessage = { role: "user" | "assistant"; content: string; citations?: Array<{ title: string; quote: string }> };

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<NavId>("inbox");
  const [objects, setObjects] = useState<KnowledgeObject[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const api = useMemo(() => new ApiClient(() => session?.accessToken), [session]);

  useEffect(() => {
    const raw = localStorage.getItem("knowledge-harvest-session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  const persistSession = (next: Session | null) => {
    setSession(next);
    if (next) localStorage.setItem("knowledge-harvest-session", JSON.stringify(next));
    else localStorage.removeItem("knowledge-harvest-session");
  };

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [nextObjects, nextDecisions, nextReports, nextGraph] = await Promise.all([
        api.request<KnowledgeObject[]>("/knowledge"),
        api.request<Decision[]>("/decisions"),
        api.request<Report[]>("/reports"),
        api.request<GraphData>("/graph")
      ]);
      setObjects(nextObjects);
      setDecisions(nextDecisions);
      setReports(nextReports);
      setGraph(nextGraph);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to refresh");
    } finally {
      setLoading(false);
    }
  }, [api, session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!session) return <AuthScreen onSession={persistSession} />;

  const readyCount = objects.filter((object) => object.status === "ready").length;
  const pendingCount = objects.filter((object) => object.status !== "ready").length;

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r bg-card lg:block">
          <div className="border-b px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold">Knowledge Harvest</h1>
                <p className="text-xs text-muted-foreground">Thinking OS</p>
              </div>
            </div>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition hover:bg-muted",
                  active === item.id && "bg-muted font-semibold"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
            <div>
              <p className="text-xs uppercase tracking-normal text-muted-foreground">Personal knowledge first</p>
              <h2 className="text-lg font-semibold">{navItems.find((item) => item.id === active)?.label}</h2>
            </div>
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Button variant="outline" size="icon" onClick={refresh} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={() => persistSession(null)} title="Log out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-3 lg:px-6">
            <Metric label="Objects" value={objects.length} detail={`${readyCount} ready`} />
            <Metric label="Processing" value={pendingCount} detail="queued or running" />
            <Metric label="Connections" value={graph.edges.length} detail={`${decisions.length} decisions`} />
          </div>

          {notice && (
            <div className="mx-4 mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm lg:mx-6">
              {notice}
            </div>
          )}

          <div className="flex-1 px-4 py-5 lg:px-6">
            {active === "inbox" && <InboxPanel api={api} onDone={refresh} setNotice={setNotice} />}
            {active === "knowledge" && <KnowledgePanel api={api} objects={objects} onDone={refresh} setNotice={setNotice} />}
            {active === "graph" && <GraphPanel graph={graph} />}
            {active === "assistant" && <AssistantPanel api={api} messages={messages} setMessages={setMessages} setNotice={setNotice} />}
            {active === "decisions" && <DecisionsPanel api={api} decisions={decisions} onDone={refresh} setNotice={setNotice} />}
            {active === "reports" && <ReportsPanel api={api} reports={reports} onDone={refresh} setNotice={setNotice} />}
            {active === "settings" && <SettingsPanel api={api} user={session.user} setNotice={setNotice} />}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t bg-card lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px]", active === item.id && "text-primary")}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function AuthScreen({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("change-me-123");
  const [name, setName] = useState("Knowledge Builder");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const api = useMemo(() => new ApiClient(() => undefined), []);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const session = await api.request<Session>(mode === "register" ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(mode === "register" ? { email, password, name } : { email, password })
      });
      onSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Knowledge Harvest</h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Capture thinking once, then reuse it across decisions, ideas, reports, and future questions.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Capture" value="1-click" detail="text, URL, file notes" />
            <Metric label="Memory" value="Graph" detail="objects and links" />
            <Metric label="AI" value="First" detail="personal context" />
          </div>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "register" ? "Create your workspace" : "Sign in"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "register" && <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />}
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
            <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
            {error && <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">{error}</p>}
            <Button className="w-full" onClick={submit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "register" ? "Create account" : "Sign in"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setMode(mode === "register" ? "login" : "register")}>
              {mode === "register" ? "Use an existing account" : "Create a new account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function InboxPanel({ api, onDone, setNotice }: PanelProps) {
  const [type, setType] = useState("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function capture() {
    setLoading(true);
    try {
      await api.request("/inbox/capture", {
        method: "POST",
        body: JSON.stringify({ type, title: title || undefined, content, sourceUrl: sourceUrl || undefined })
      });
      setContent("");
      setTitle("");
      setSourceUrl("");
      setNotice("Captured. Harvest and embedding jobs are queued.");
      await onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Capture failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Quick Capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {["text", "url", "voice", "image", "file"].map((item) => (
              <Button key={item} variant={type === item ? "primary" : "outline"} size="sm" onClick={() => setType(item)}>
                {item}
              </Button>
            ))}
          </div>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" />
          {type === "url" && <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://source.example" />}
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste a note, transcript, decision fragment, URL notes, or file/image description." />
          <Button onClick={capture} disabled={!content.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Capture
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Harvest Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <PipelineStep label="Create Knowledge Object" />
          <PipelineStep label="Extract insights and risks" />
          <PipelineStep label="Generate embeddings" />
          <PipelineStep label="Detect relationships" />
          <PipelineStep label="Surface in assistant and reports" />
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineStep({ label }: { label: string }) {
  return <div className="rounded-md border bg-background px-3 py-2">{label}</div>;
}

function KnowledgePanel({ api, objects, onDone, setNotice }: PanelProps & { objects: KnowledgeObject[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeObject[] | null>(null);

  async function search() {
    try {
      const response = await api.request<Array<{ object: KnowledgeObject; score: number }>>("/search/hybrid", {
        method: "POST",
        body: JSON.stringify({ query, limit: 20 })
      });
      setResults(response.map((item) => item.object));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Search failed");
    }
  }

  async function reprocess(id: string) {
    await api.request(`/knowledge/${id}/reprocess`, { method: "POST" });
    setNotice("Reprocessing queued.");
    await onDone();
  }

  const shown = results ?? objects;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search personal knowledge" />
        <Button variant="outline" size="icon" onClick={search} disabled={!query.trim()} title="Search">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {shown.map((object) => (
          <Card key={object.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="line-clamp-1">{object.title}</CardTitle>
              <span className="rounded-md border px-2 py-1 text-xs">{object.status}</span>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="line-clamp-3 text-muted-foreground">{object.structuredSummary || object.rawContent}</p>
              <TagRow values={[...(object.categories ?? []), ...(object.tags ?? [])].slice(0, 8)} />
              <Button variant="outline" size="sm" onClick={() => reprocess(object.id)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reprocess
              </Button>
            </CardContent>
          </Card>
        ))}
        {!shown.length && <EmptyState title="No knowledge yet" detail="Capture something in the inbox to start compounding." />}
      </div>
    </div>
  );
}

function TagRow({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span key={value} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {value}
        </span>
      ))}
    </div>
  );
}

function GraphPanel({ graph }: { graph: GraphData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = graph.nodes.slice(0, 24);
  const center = 260;
  const radius = 190;
  const positions = new Map(
    nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
      return [node.id, { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius, node }] as const;
    })
  );
  const selectedNode = selected ? positions.get(selected)?.node : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <svg viewBox="0 0 520 520" className="h-[520px] w-full rounded-md border bg-background">
            {graph.edges.map((edge) => {
              const source = positions.get(edge.source);
              const target = positions.get(edge.target);
              if (!source || !target) return null;
              return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="hsl(var(--border))" strokeWidth={1 + edge.strength * 3} />;
            })}
            {nodes.map((node) => {
              const position = positions.get(node.id)!;
              return (
                <g key={node.id} onClick={() => setSelected(node.id)} className="cursor-pointer">
                  <circle cx={position.x} cy={position.y} r={selected === node.id ? 24 : 18} fill="hsl(var(--primary))" opacity={node.status === "ready" ? 0.9 : 0.45} />
                  <text x={position.x} y={position.y + 36} textAnchor="middle" className="fill-current text-[10px]">
                    {node.title.slice(0, 22)}
                  </text>
                </g>
              );
            })}
          </svg>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{selectedNode ? selectedNode.title : "Graph Details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {selectedNode ? <TagRow values={selectedNode.tags.slice(0, 10)} /> : <p>Select a node to inspect its tags and relationship context.</p>}
          <p>{graph.nodes.length} nodes, {graph.edges.length} relationships.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AssistantPanel({ api, messages, setMessages, setNotice }: {
  api: ApiClient;
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  setNotice: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setLoading(true);
    setMessage("");
    try {
      const conversation = await api.request<{ messages: ChatMessage[] }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message })
      });
      setMessages(conversation.messages);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Assistant failed");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thinking Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="min-h-[360px] space-y-3 rounded-md border bg-background p-3">
          {messages.map((item, index) => (
            <div key={index} className={cn("max-w-3xl rounded-md px-3 py-2 text-sm", item.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
              <p className="whitespace-pre-wrap">{item.content}</p>
              {!!item.citations?.length && <TagRow values={item.citations.map((citation) => citation.title).slice(0, 5)} />}
            </div>
          ))}
          {!messages.length && <EmptyState title="Ask from memory" detail="Try: What do I already know about customer retention?" />}
        </div>
        <div className="flex gap-2">
          <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask your personal knowledge graph" />
          <Button onClick={send} disabled={!message.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Ask
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionsPanel({ api, decisions, onDone, setNotice }: PanelProps & { decisions: Decision[] }) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [finalChoice, setFinalChoice] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");

  async function createDecision() {
    try {
      await api.request("/decisions", {
        method: "POST",
        body: JSON.stringify({
          title,
          context,
          optionsConsidered: ["Option A", "Option B"],
          reasoning: context,
          finalChoice,
          expectedOutcome
        })
      });
      setTitle("");
      setContext("");
      setFinalChoice("");
      setExpectedOutcome("");
      setNotice("Decision recorded and queued as knowledge.");
      await onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Decision failed");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Record Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Decision title" />
          <Textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Context, options, and reasoning" />
          <Input value={finalChoice} onChange={(event) => setFinalChoice(event.target.value)} placeholder="Final choice" />
          <Input value={expectedOutcome} onChange={(event) => setExpectedOutcome(event.target.value)} placeholder="Expected outcome" />
          <Button onClick={createDecision} disabled={!title || !context || !finalChoice || !expectedOutcome}>Save decision</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {decisions.map((decision) => (
          <DecisionCard key={decision.id} decision={decision} api={api} onDone={onDone} setNotice={setNotice} />
        ))}
        {!decisions.length && <EmptyState title="No decisions yet" detail="Record the reasoning now so future-you can compare outcomes." />}
      </div>
    </div>
  );
}

function DecisionCard({ decision, api, onDone, setNotice }: { decision: Decision } & PanelProps) {
  const [actualOutcome, setActualOutcome] = useState("");

  async function review() {
    try {
      await api.request(`/decisions/${decision.id}/review`, {
        method: "POST",
        body: JSON.stringify({ actualOutcome })
      });
      setActualOutcome("");
      setNotice("Decision review generated.");
      await onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Review failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{decision.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{decision.context}</p>
        <p><strong>Choice:</strong> {decision.finalChoice}</p>
        <p><strong>Expected:</strong> {decision.expectedOutcome}</p>
        {decision.learningReport && <p className="rounded-md bg-muted p-3">{decision.learningReport}</p>}
        <div className="flex gap-2">
          <Input value={actualOutcome} onChange={(event) => setActualOutcome(event.target.value)} placeholder="Actual outcome" />
          <Button variant="outline" onClick={review} disabled={!actualOutcome.trim()}>Review</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsPanel({ api, reports, onDone, setNotice }: PanelProps & { reports: Report[] }) {
  async function generate(path: string, label: string) {
    try {
      await api.request(path, { method: "POST" });
      setNotice(`${label} generated.`);
      await onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Report failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate("/reports/generate-weekly", "Weekly report")}>Generate weekly report</Button>
        <Button variant="outline" onClick={() => generate("/patterns/analyze", "Pattern report")}>Analyze patterns</Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle>{report.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{report.summary}</p>
              <TagRow values={[...report.themes, ...report.recommendations].slice(0, 8)} />
            </CardContent>
          </Card>
        ))}
        {!reports.length && <EmptyState title="No reports yet" detail="Generate weekly intelligence or pattern reports once knowledge exists." />}
      </div>
    </div>
  );
}

function SettingsPanel({ api, user, setNotice }: { api: ApiClient; user: Session["user"]; setNotice: (message: string) => void }) {
  const [model, setModel] = useState("openai/gpt-4.1-mini");
  const [temperature, setTemperature] = useState(0.2);

  async function save() {
    try {
      await api.request(user.role === "admin" ? "/admin/settings" : "/settings", {
        method: "PATCH",
        body: JSON.stringify({ model, temperature, maxTokens: 4000 })
      });
      setNotice("Settings saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Settings failed");
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>AI Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="OpenRouter model" />
        <label className="block text-sm">
          <span className="text-muted-foreground">Temperature: {temperature}</span>
          <input className="mt-2 w-full" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
        </label>
        <Button onClick={save}>Save settings</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

type PanelProps = {
  api: ApiClient;
  onDone: () => Promise<void>;
  setNotice: (message: string) => void;
};
