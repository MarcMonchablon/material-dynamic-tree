import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DocumentationComponent } from './examples/documentation/documentation.component';
import { FoldersComponent } from './examples/folders/folders.component';

const routes: Routes = [
  { path: 'examples/documentation', component: DocumentationComponent },
  { path: 'examples/folders', component: FoldersComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
