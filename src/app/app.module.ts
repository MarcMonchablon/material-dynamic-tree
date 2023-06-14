import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTreeModule } from '@angular/material/tree';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { FoldersService } from './_services/folders.service';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DocumentationComponent } from './examples/documentation/documentation.component';
import { FoldersComponent } from './examples/folders/folders.component';
import { DynamicTreeComponent } from './components/dynamic-tree/dynamic-tree.component';

@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatTreeModule,
    MatExpansionModule,
    MatProgressBarModule,
    BrowserAnimationsModule,
  ],
  declarations: [
    AppComponent,
    DocumentationComponent,
    FoldersComponent,
    DynamicTreeComponent,
  ],
  providers: [
    FoldersService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
