<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SettingsRequest;
use App\Services\AuditLogger;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class SettingsController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /** Paramètres utiles à tous les écrans (nom de la salle, options du scan…). */
    public function show(): JsonResponse
    {
        $settings = Settings::all();
        $settings['logo_url'] = $settings['logo_path'] ? '/api/v1/settings/logo' : null;
        unset($settings['logo_path']);

        return response()->json(['data' => $settings]);
    }

    public function update(SettingsRequest $request): JsonResponse
    {
        $before = Settings::all();
        $changes = array_filter(
            $request->validated(),
            fn ($value, $key) => ($before[$key] ?? null) !== $value,
            ARRAY_FILTER_USE_BOTH,
        );

        if ($changes !== []) {
            Settings::put($changes);
            $this->audit->log('parametres.modification', 'Settings', array_intersect_key($before, $changes), $changes);
        }

        return $this->show();
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:png,jpeg,webp', 'max:2048']]);

        $old = Settings::get('logo_path');
        $path = $request->file('logo')->store('settings', 'local');
        Settings::put(['logo_path' => $path]);
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        $this->audit->log('parametres.logo', 'Settings', ['logo_path' => $old], ['logo_path' => $path]);

        return $this->show();
    }

    public function logo(): Response
    {
        $path = Settings::get('logo_path');
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path);
    }
}
