import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl } from '@angular/forms';
import { FoldersService } from '../../_services/folders.service';

@Component({
  selector: 'app-folders',
  templateUrl: './folders.component.html',
  styleUrls: ['./folders.component.scss']
})
export class FoldersComponent implements OnInit {
  public treeRequired: boolean = false;
  public treeForm!: UntypedFormControl;

  constructor(
    private foldersSrv: FoldersService,
    private _fb: UntypedFormBuilder,
  ) {}

  ngOnInit(): void {
    const defaultFolderId = this.foldersSrv.getDefaultFolderId();
    this.treeForm = this._fb.control(defaultFolderId);
  }

  onFolderSelected(val: string): void {
    console.group('[FoldersComponent] onFolderSelected');
    console.log('val: ', val);
    console.groupEnd();
  }
}
