<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExpenseCategory;
use App\Enums\ExpenseStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseRequest;
use App\Http\Requests\ReasonRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Services\ExpenseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class ExpenseController extends Controller
{
    public function __construct(private readonly ExpenseService $expenses) {}

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Expense::class);
        $request->validate([
            'statut' => ['nullable', Rule::enum(ExpenseStatus::class)],
            'categorie' => ['nullable', Rule::enum(ExpenseCategory::class)],
            'du' => ['nullable', 'date_format:Y-m-d'],
            'au' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $user = $request->user();

        $expenses = Expense::query()
            ->with(['user', 'validator'])
            ->when(! $user->isAdmin(), fn ($q) => $q->where('user_id', $user->id))
            ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->input('statut')))
            ->when($request->filled('categorie'), fn ($q) => $q->where('categorie', $request->input('categorie')))
            ->when($request->filled('du'), fn ($q) => $q->whereDate('date_depense', '>=', $request->input('du')))
            ->when($request->filled('au'), fn ($q) => $q->whereDate('date_depense', '<=', $request->input('au')))
            ->orderByDesc('date_depense')
            ->orderByDesc('id')
            ->paginate(25);

        return ExpenseResource::collection($expenses);
    }

    public function store(ExpenseRequest $request)
    {
        Gate::authorize('create', Expense::class);

        $expense = $this->expenses->create(
            collect($request->validated())->except('justificatif')->all(),
            $request->file('justificatif'),
            $request->user(),
        );

        return (new ExpenseResource($expense->load(['user', 'validator'])))->response()->setStatusCode(201);
    }

    public function justificatif(Expense $expense): Response
    {
        Gate::authorize('view', $expense);
        abort_unless($expense->justificatif_path && Storage::disk(ExpenseService::DISK)->exists($expense->justificatif_path), 404);

        return Storage::disk(ExpenseService::DISK)->response($expense->justificatif_path);
    }

    public function validateExpense(Request $request, Expense $expense)
    {
        return $this->decide($request, $expense, ExpenseStatus::Validee, null);
    }

    public function reject(ReasonRequest $request, Expense $expense)
    {
        return $this->decide($request, $expense, ExpenseStatus::Rejetee, $request->input('motif'));
    }

    public function cancel(ReasonRequest $request, Expense $expense)
    {
        return $this->decide($request, $expense, ExpenseStatus::Annulee, $request->input('motif'));
    }

    private function decide(Request $request, Expense $expense, ExpenseStatus $decision, ?string $motif)
    {
        Gate::authorize('decide', $expense);

        $expense = $this->expenses->decide($expense, $decision, $request->user(), $motif);

        return new ExpenseResource($expense->load(['user', 'validator']));
    }
}
