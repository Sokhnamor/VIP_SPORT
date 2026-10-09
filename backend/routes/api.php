<?php

use App\Http\Controllers\Api\V1\AlertController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashSessionController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\MemberController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PlanController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\ScanController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\Api\V1\TicketController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
| API v1 — JSON uniquement. Toutes les règles métier et tous les contrôles de droits
| décisifs sont ici (middleware de rôle + policies + services), jamais dans le front.
|
| Rôles : admin (tout), receptionniste (accueil), scanner (écran de scan uniquement).
*/

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('auth.login');

    Route::middleware(['auth:sanctum', 'account.usable', 'password.changed', 'throttle:api'])->group(function () {
        // --- Tous les rôles -----------------------------------------------------------
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::post('auth/password', [AuthController::class, 'changePassword'])->name('auth.password');
        Route::get('settings', [SettingsController::class, 'show'])->name('settings.public');
        Route::get('settings/logo', [SettingsController::class, 'logo'])->name('settings.logo');

        // Photo d'un membre : URL signée temporaire obligatoire (affichée au scan).
        Route::get('members/{member}/photo', [MemberController::class, 'photo'])
            ->middleware('signed:relative')
            ->name('members.photo');

        // --- Poste de scan (scanner, et réception / admin) ----------------------------
        Route::middleware('role:scanner,receptionniste,admin')->group(function () {
            Route::post('scan', [ScanController::class, 'scan'])->middleware('throttle:scan')->name('scan');
            Route::get('scan/stats', [ScanController::class, 'stats'])->name('scan.stats');
        });

        // --- Réception (réceptionniste et admin) --------------------------------------
        Route::middleware('role:receptionniste,admin')->group(function () {
            Route::get('plans', [PlanController::class, 'index'])->name('plans.index');

            Route::get('members', [MemberController::class, 'index'])->name('members.index');
            Route::post('members', [MemberController::class, 'store'])->name('members.store');
            Route::get('members/{member}', [MemberController::class, 'show'])->name('members.show');
            Route::match(['put', 'patch', 'post'], 'members/{member}', [MemberController::class, 'update'])->name('members.update');
            Route::get('members/{member}/quote', [MemberController::class, 'quote'])->name('members.quote');
            Route::get('members/{member}/qr', [MemberController::class, 'qr'])->name('members.qr');
            Route::get('members/{member}/card', [MemberController::class, 'card'])->name('members.card');

            Route::post('sales/subscription', [SaleController::class, 'subscription'])->name('sales.subscription');
            Route::post('sales/ticket', [SaleController::class, 'ticket'])->name('sales.ticket');

            Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');
            Route::get('payments/{payment}', [PaymentController::class, 'show'])->name('payments.show');
            Route::get('payments/{payment}/receipt', [PaymentController::class, 'receipt'])->name('payments.receipt');
            Route::post('payments/{payment}/cancel', [PaymentController::class, 'cancel'])->name('payments.cancel');
            // Immuabilité : modification et suppression explicitement refusées (403), pour tous.
            Route::match(['put', 'patch', 'delete'], 'payments/{payment}', [PaymentController::class, 'forbidden'])->name('payments.forbidden');

            Route::get('tickets/{ticket}', [TicketController::class, 'show'])->name('tickets.show');
            Route::get('tickets/{ticket}/qr', [TicketController::class, 'qr'])->name('tickets.qr');
            Route::get('tickets/{ticket}/pdf', [TicketController::class, 'pdf'])->name('tickets.pdf');

            Route::get('cash-sessions', [CashSessionController::class, 'index'])->name('cash-sessions.index');
            Route::get('cash-sessions/current', [CashSessionController::class, 'current'])->name('cash-sessions.current');
            Route::post('cash-sessions', [CashSessionController::class, 'store'])->name('cash-sessions.store');
            Route::get('cash-sessions/{cashSession}', [CashSessionController::class, 'show'])->name('cash-sessions.show');
            Route::post('cash-sessions/{cashSession}/close', [CashSessionController::class, 'close'])->name('cash-sessions.close');
            Route::get('cash-sessions/{cashSession}/mobile-money', [CashSessionController::class, 'mobileMoney'])->name('cash-sessions.mobile-money');

            Route::get('expenses', [ExpenseController::class, 'index'])->name('expenses.index');
            Route::post('expenses', [ExpenseController::class, 'store'])->name('expenses.store');
            Route::get('expenses/{expense}/justificatif', [ExpenseController::class, 'justificatif'])->name('expenses.justificatif');

            Route::post('access/manual', [ScanController::class, 'manual'])->name('access.manual');
            Route::get('presences/today', [AttendanceController::class, 'today'])->name('presences.today');
        });

        // --- Administration (patron) ---------------------------------------------------
        Route::middleware('role:admin')->group(function () {
            Route::get('dashboard', DashboardController::class)->name('dashboard');
            Route::get('reports/{type}', [ReportController::class, 'show'])->name('reports.show');
            Route::get('alerts', [AlertController::class, 'index'])->name('alerts.index');
            Route::get('alerts/{liste}/export', [AlertController::class, 'export'])->name('alerts.export');

            Route::post('plans', [PlanController::class, 'store'])->name('plans.store');
            Route::match(['put', 'patch'], 'plans/{plan}', [PlanController::class, 'update'])->name('plans.update');

            Route::post('members/{member}/archive', [MemberController::class, 'archive'])->name('members.archive');
            Route::post('members/{member}/unarchive', [MemberController::class, 'unarchive'])->name('members.unarchive');
            Route::post('members/{member}/anonymize', [MemberController::class, 'anonymize'])->name('members.anonymize');
            Route::post('members/{member}/regenerate-qr', [MemberController::class, 'regenerateQr'])->name('members.regenerate-qr');
            Route::get('members/{member}/export', [MemberController::class, 'export'])->name('members.export');

            Route::post('subscriptions/{subscription}/suspend', [SubscriptionController::class, 'suspend'])->name('subscriptions.suspend');
            Route::post('subscriptions/{subscription}/resume', [SubscriptionController::class, 'resume'])->name('subscriptions.resume');

            Route::post('cash-sessions/{cashSession}/comment', [CashSessionController::class, 'comment'])->name('cash-sessions.comment');

            Route::post('expenses/{expense}/validate', [ExpenseController::class, 'validateExpense'])->name('expenses.validate');
            Route::post('expenses/{expense}/reject', [ExpenseController::class, 'reject'])->name('expenses.reject');
            Route::post('expenses/{expense}/cancel', [ExpenseController::class, 'cancel'])->name('expenses.cancel');

            Route::get('access-logs', [AttendanceController::class, 'logs'])->name('access-logs.index');

            Route::get('users', [UserController::class, 'index'])->name('users.index');
            Route::post('users', [UserController::class, 'store'])->name('users.store');
            Route::match(['put', 'patch'], 'users/{user}', [UserController::class, 'update'])->name('users.update');
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');

            Route::get('audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
            Route::get('audit-logs/actions', [AuditLogController::class, 'actions'])->name('audit-logs.actions');

            Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
            Route::post('settings/logo', [SettingsController::class, 'uploadLogo'])->name('settings.logo.upload');
        });
    });
});
