<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $cle
 * @property string|null $valeur
 */
#[Fillable(['cle', 'valeur'])]
class Setting extends Model
{
    protected $primaryKey = 'cle';

    protected $keyType = 'string';

    public $incrementing = false;
}
